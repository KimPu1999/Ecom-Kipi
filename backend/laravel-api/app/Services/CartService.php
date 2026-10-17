<?php

namespace App\Services;

use App\Models\Cart;
use App\Models\CartItem;
use App\Models\ProductVariant;
use Illuminate\Support\Facades\DB;
use Illuminate\Validation\ValidationException;

class CartService
{
    public function getForUser(int $userId): Cart
    {
        return Cart::query()->firstOrCreate(['user_id' => $userId])->load([
            'items.variant.product.category',
            'items.variant.product.images',
            'items.variant.product.seller',
            'items.variant.product.variants.inventory',
            'items.variant.inventory',
        ]);
    }

    public function add(int $userId, int $variantId, int $quantity): Cart
    {
        return DB::transaction(function () use ($userId, $variantId, $quantity) {
            $variant = ProductVariant::query()->with(['product', 'inventory'])->findOrFail($variantId);
            $this->assertAvailable($variant, $quantity);
            $cart = Cart::query()->firstOrCreate(['user_id' => $userId]);
            $item = CartItem::query()->firstOrNew([
                'cart_id' => $cart->id,
                'product_variant_id' => $variant->id,
            ]);
            $nextQuantity = ($item->exists ? $item->quantity : 0) + $quantity;
            $this->assertAvailable($variant, $nextQuantity);
            $item->quantity = $nextQuantity;
            $item->save();

            return $cart->fresh()->load(['items.variant.product.images', 'items.variant.product.seller', 'items.variant.product.variants.inventory', 'items.variant.inventory']);
        });
    }

    public function update(CartItem $item, int $quantity): Cart
    {
        $item->load('cart', 'variant.inventory', 'variant.product');
        $this->assertAvailable($item->variant, $quantity);
        $item->update(['quantity' => $quantity]);

        return $item->cart->fresh()->load(['items.variant.product.images', 'items.variant.product.seller', 'items.variant.product.variants.inventory', 'items.variant.inventory']);
    }

    public function remove(CartItem $item): Cart
    {
        $cart = $item->cart;
        $item->delete();

        return $cart->fresh()->load(['items.variant.product.images', 'items.variant.product.seller', 'items.variant.product.variants.inventory', 'items.variant.inventory']);
    }

    public function clear(Cart $cart): Cart
    {
        $cart->items()->delete();

        return $cart->load(['items.variant.product.images', 'items.variant.product.seller', 'items.variant.product.variants.inventory', 'items.variant.inventory']);
    }

    public function totals(Cart $cart): array
    {
        $subtotal = $cart->items->sum(fn (CartItem $item) => $item->quantity * $item->variant->price_minor);

        return ['subtotal_minor' => $subtotal, 'item_count' => $cart->items->sum('quantity')];
    }

    private function assertAvailable(ProductVariant $variant, int $quantity): void
    {
        if (! $variant->is_active || $variant->product->status !== 'published') {
            throw ValidationException::withMessages(['variant_id' => 'This product variant is not available.']);
        }

        if ($variant->inventory?->availableQuantity() < $quantity) {
            throw ValidationException::withMessages(['quantity' => 'The requested quantity is not available.']);
        }
    }
}
