<?php

namespace App\Http\Resources;

use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

class OrderResource extends JsonResource
{
    public function toArray(Request $request): array
    {
        return [
            'id' => $this->id,
            'order_number' => $this->order_number,
            'shipping_address' => $this->shipping_address,
            'billing_address' => $this->billing_address,
            'subtotal_minor' => $this->subtotal_minor,
            'discount_minor' => $this->discount_minor,
            'shipping_minor' => $this->shipping_minor,
            'tax_minor' => $this->tax_minor,
            'grand_total_minor' => $this->grand_total_minor,
            'currency' => $this->currency,
            'payment_status' => $this->payment_status,
            'fulfillment_status' => $this->fulfillment_status,
            'placed_at' => $this->placed_at?->toISOString(),
            'cancelled_at' => $this->cancelled_at?->toISOString(),
            'user' => new UserResource($this->whenLoaded('user')),
            'items' => $this->whenLoaded('items', fn () => $this->items->map(fn ($item) => [
                'id' => $item->id,
                'product_name' => $item->product_name,
                'sku' => $item->sku,
                'quantity' => $item->quantity,
                'attributes' => $item->attributes,
                'unit_price_minor' => $item->unit_price_minor,
                'line_total_minor' => $item->line_total_minor,
                'seller' => $item->seller ? ['id' => $item->seller->id, 'store_name' => $item->seller->store_name, 'slug' => $item->seller->slug] : null,
                'product_image' => $item->variant?->product?->images?->firstWhere('is_primary', true)?->url ?? $item->variant?->product?->images?->first()?->url,
            ])),
            'seller_orders' => $this->whenLoaded('sellerOrders', fn () => $this->sellerOrders->map(fn ($sellerOrder) => [
                'id' => $sellerOrder->id,
                'order_number' => $sellerOrder->order_number,
                'seller' => $sellerOrder->seller ? ['id' => $sellerOrder->seller->id, 'store_name' => $sellerOrder->seller->store_name, 'slug' => $sellerOrder->seller->slug] : null,
                'status' => $sellerOrder->status,
                'payment_status' => $sellerOrder->payment_status,
                'fulfillment_status' => $sellerOrder->fulfillment_status,
                'subtotal_minor' => $sellerOrder->subtotal_minor,
                'shipping_minor' => $sellerOrder->shipping_minor,
                'commission_minor' => $sellerOrder->commission_minor,
                'net_minor' => $sellerOrder->net_minor,
                'currency' => $sellerOrder->currency,
                'items' => $sellerOrder->items,
                'commission_snapshots' => $this->when(
                    ($request->user()?->hasRole('super_admin') || $request->user()?->hasPermission('manage_marketplace')) && $sellerOrder->relationLoaded('commissions'),
                    fn () => $sellerOrder->commissions->map(fn ($commission) => [
                        'id' => $commission->id,
                        'seller_id' => $commission->seller_id,
                        'brand_id' => $commission->brand_id,
                        'rule_source' => $commission->rule_source,
                        'status' => $commission->status,
                        'percentage_bps' => $commission->percentage_bps,
                        'fixed_minor' => $commission->fixed_minor,
                        'eligible_subtotal_minor' => $commission->gross_minor,
                        'commission_minor' => $commission->commission_minor,
                        'currency' => $commission->currency,
                        'confirmed_at' => $commission->confirmed_at?->toISOString(),
                    ]),
                ),
            ])),
            'status_history' => $this->whenLoaded('statusHistory'),
            'notes' => $this->whenLoaded('notes'),
            'shipping_method' => $this->whenLoaded('shippingMethod'),
            'payments' => $this->whenLoaded('payments'),
            'shipments' => $this->whenLoaded('shipments'),
            'refunds' => $this->whenLoaded('refunds'),
        ];
    }
}
