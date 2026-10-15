<?php

namespace App\Services;

use App\Models\Coupon;
use App\Models\CouponUsage;
use App\Models\Order;
use App\Models\User;
use App\Notifications\OrderCreatedNotification;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Str;
use Illuminate\Validation\ValidationException;

class CheckoutService
{
    public function __construct(
        private readonly PricingService $pricing,
        private readonly InventoryReservationService $reservations,
        private readonly MarketplaceOrderService $marketplace,
    ) {}

    public function confirm(User $user, array $data): Order
    {
        $key = $data['idempotency_key'] ?? (string) Str::uuid();
        $existing = Order::query()->where('user_id', $user->id)->where('idempotency_key', $key)->first();
        if ($existing) {
            return $existing->load(['items', 'statusHistory', 'shippingMethod']);
        }

        return DB::transaction(function () use ($user, $data, $key) {
            $pricing = $this->pricing->calculate($user, $data['shipping_method_id'] ?? null, $data['coupon_code'] ?? null);
            $coupon = $pricing['coupon'] ? Coupon::query()->lockForUpdate()->find($pricing['coupon']->id) : null;
            if ($coupon && $coupon->usage_limit !== null && $coupon->usage_count >= $coupon->usage_limit) {
                throw ValidationException::withMessages(['coupon_code' => 'This coupon has reached its usage limit.']);
            }
            $order = Order::query()->create([
                'user_id' => $user->id,
                'order_number' => 'ORD-'.strtoupper(Str::random(10)),
                'shipping_address' => $data['shipping_address'],
                'billing_address' => $data['billing_address'] ?? $data['shipping_address'],
                'shipping_method_id' => $pricing['shipping_method']->id,
                'coupon_id' => $coupon?->id,
                'coupon_code' => $coupon?->code,
                'subtotal_minor' => $pricing['subtotal_minor'],
                'discount_minor' => $pricing['discount_minor'],
                'shipping_minor' => $pricing['shipping_minor'],
                'tax_minor' => $pricing['tax_minor'],
                'grand_total_minor' => $pricing['grand_total_minor'],
                'currency' => $pricing['currency'],
                'payment_status' => 'pending',
                'fulfillment_status' => 'pending',
                'idempotency_key' => $key,
                'placed_at' => now(),
            ]);
            foreach ($pricing['lines'] as $line) {
                $order->items()->create([
                    'product_variant_id' => $line['variant_id'],
                    'seller_id' => $line['seller_id'],
                    'product_name' => $line['name'],
                    'sku' => $line['sku'],
                    'quantity' => $line['quantity'],
                    'unit_price_minor' => $line['unit_price_minor'],
                    'line_total_minor' => $line['line_total_minor'],
                    'attributes' => $line['attributes'],
                ]);
            }
            $this->marketplace->createSellerOrders($order);
            $this->reservations->reserveOrder($order, $pricing['lines'], $user->id);
            if (($data['payment_method'] ?? null) === 'cod') {
                $payment = $order->payments()->create([
                    'provider' => 'cod',
                    'status' => 'pending',
                    'amount_minor' => $order->grand_total_minor,
                    'currency' => $order->currency,
                    'metadata' => array_merge($data['payment_metadata'] ?? [], ['collection_status' => 'awaiting_delivery']),
                ]);
                $payment->attempts()->create([
                    'attempt_number' => 1,
                    'idempotency_key' => $key,
                    'status' => 'pending',
                ]);
            }
            $order->statusHistory()->create(['status_type' => 'fulfillment', 'to_status' => 'pending', 'changed_by' => $user->id, 'note' => 'Checkout confirmed; payment pending.']);
            $pricing['cart']->items()->delete();
            if ($coupon) {
                $coupon->increment('usage_count');
                CouponUsage::query()->create(['coupon_id' => $coupon->id, 'user_id' => $user->id, 'order_id' => $order->id, 'discount_minor' => $pricing['discount_minor']]);
            }
            $user->notify(new OrderCreatedNotification($order->fresh()));

            return $order->load(['items', 'statusHistory', 'shippingMethod']);
        });
    }
}
