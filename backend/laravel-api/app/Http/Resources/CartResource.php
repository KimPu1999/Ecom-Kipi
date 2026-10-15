<?php

namespace App\Http\Resources;

use App\Services\CartService;
use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

class CartResource extends JsonResource
{
    public function toArray(Request $request): array
    {
        $totals = app(CartService::class)->totals($this->resource);

        return [
            'id' => $this->id,
            'items' => $this->items->map(fn ($item) => [
                'id' => $item->id,
                'quantity' => $item->quantity,
                'variant' => [
                    'id' => $item->variant->id,
                    'sku' => $item->variant->sku,
                    'price_minor' => $item->variant->price_minor,
                    'currency' => $item->variant->currency,
                    'attributes' => $item->variant->attributes,
                    'product' => [
                        'id' => $item->variant->product->id,
                        'name' => $item->variant->product->name,
                        'slug' => $item->variant->product->slug,
                        'variants' => $item->variant->product->variants->map(fn ($variant) => [
                            'id' => $variant->id,
                            'sku' => $variant->sku,
                            'price_minor' => $variant->price_minor,
                            'currency' => $variant->currency,
                            'attributes' => $variant->attributes,
                            'is_active' => $variant->is_active,
                            'available_quantity' => $variant->inventory?->availableQuantity(),
                        ]),
                    ],
                ],
                'line_total_minor' => $item->quantity * $item->variant->price_minor,
            ]),
            'subtotal_minor' => $totals['subtotal_minor'],
            'item_count' => $totals['item_count'],
        ];
    }
}
