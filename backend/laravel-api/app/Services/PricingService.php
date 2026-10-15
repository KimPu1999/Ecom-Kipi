<?php

namespace App\Services;

use App\Models\Cart;
use App\Models\Coupon;
use App\Models\Seller;
use App\Models\ShippingMethod;
use App\Models\User;
use Illuminate\Validation\ValidationException;

class PricingService
{
    public function calculate(User $user, ?int $shippingMethodId = null, ?string $couponCode = null): array
    {
        /** @var Cart|null $cart */
        $cart = $user->cart()->with(['items.variant.product.seller', 'items.variant.inventory'])->first();
        if (! $cart || $cart->items->isEmpty()) {
            throw ValidationException::withMessages(['cart' => 'Your cart is empty.']);
        }

        $method = $shippingMethodId
            ? ShippingMethod::query()->whereKey($shippingMethodId)->where('is_active', true)->first()
            : ShippingMethod::query()->where('is_active', true)->orderBy('sort_order')->first();
        if (! $method) {
            throw ValidationException::withMessages(['shipping_method_id' => 'This shipping method is not available.']);
        }

        $currency = null;
        $subtotal = 0;
        $lines = [];
        foreach ($cart->items as $item) {
            $variant = $item->variant;
            if (! $variant || ! $variant->is_active || $variant->product->status !== 'published') {
                throw ValidationException::withMessages(['cart' => 'One or more products are no longer available.']);
            }
            if ($variant->product->seller && ! in_array($variant->product->seller->status, [Seller::STATUS_APPROVED, 'active'], true)) {
                throw ValidationException::withMessages(['cart' => 'One or more seller products are no longer available.']);
            }
            if (($variant->inventory?->availableQuantity() ?? 0) < $item->quantity) {
                throw ValidationException::withMessages(['stock' => "Insufficient stock for {$variant->sku}."]);
            }
            $currency ??= $variant->currency;
            if ($currency !== $variant->currency || $currency !== $method->currency) {
                throw ValidationException::withMessages(['currency' => 'Cart items and shipping method must use one currency.']);
            }
            $lineTotal = $item->quantity * $variant->price_minor;
            $subtotal += $lineTotal;
            $lines[] = [
                'cart_item_id' => $item->id,
                'variant_id' => $variant->id,
                'seller_id' => $variant->product->seller_id,
                'sku' => $variant->sku,
                'name' => $variant->product->name,
                'quantity' => $item->quantity,
                'unit_price_minor' => $variant->price_minor,
                'line_total_minor' => $lineTotal,
                'attributes' => $variant->attributes,
            ];
        }

        $coupon = null;
        $discount = 0;
        if ($couponCode) {
            $coupon = Coupon::query()->whereRaw('UPPER(code) = ?', [strtoupper($couponCode)])->where('is_active', true)->first();
            if (! $coupon || ($coupon->starts_at && $coupon->starts_at->isFuture()) || ($coupon->ends_at && $coupon->ends_at->isPast())) {
                throw ValidationException::withMessages(['coupon_code' => 'This coupon is not available.']);
            }
            if ($coupon->usage_limit !== null && $coupon->usage_count >= $coupon->usage_limit) {
                throw ValidationException::withMessages(['coupon_code' => 'This coupon has reached its usage limit.']);
            }
            if ($coupon->usages()->where('user_id', $user->id)->count() >= $coupon->per_user_limit) {
                throw ValidationException::withMessages(['coupon_code' => 'You have already used this coupon.']);
            }
            if ($subtotal < $coupon->minimum_subtotal_minor) {
                throw ValidationException::withMessages(['coupon_code' => 'Your subtotal does not meet this coupon minimum.']);
            }
            $discount = $coupon->type === 'percentage' ? (int) floor($subtotal * $coupon->value / 10000) : $coupon->value;
            if ($coupon->maximum_discount_minor !== null) {
                $discount = min($discount, $coupon->maximum_discount_minor);
            }
            $discount = min($discount, $subtotal);
        }
        $shipping = $method->price_minor;
        $tax = (int) round($subtotal * config('commerce.tax_rate_bps', 0) / 10000);

        return [
            'cart' => $cart,
            'shipping_method' => $method,
            'lines' => $lines,
            'currency' => $currency ?? $method->currency,
            'subtotal_minor' => $subtotal,
            'discount_minor' => $discount,
            'shipping_minor' => $shipping,
            'tax_minor' => $tax,
            'grand_total_minor' => max(0, $subtotal - $discount + $shipping + $tax),
            'item_count' => $cart->items->sum('quantity'),
            'coupon' => $coupon,
            'coupon_code' => $coupon?->code,
        ];
    }
}
