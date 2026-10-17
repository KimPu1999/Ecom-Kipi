<?php

namespace App\Http\Resources;

use App\Services\CartService;
use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;
use Illuminate\Support\Str;

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
                    'is_active' => $item->variant->is_active,
                    'available_quantity' => $item->variant->inventory?->availableQuantity() ?? 0,
                    'product' => [
                        'id' => $item->variant->product->id,
                        'name' => $item->variant->product->name,
                        'slug' => $item->variant->product->slug,
                        'status' => $item->variant->product->status,
                        'seller' => $item->variant->product->seller ? [
                            'id' => $item->variant->product->seller->id,
                            'store_name' => $item->variant->product->seller->store_name,
                            'slug' => $item->variant->product->seller->slug,
                        ] : null,
                        'images' => $item->variant->product->images->map(fn ($image) => [
                            'id' => $image->id,
                            'url' => $this->imageUrl($request, $image->url),
                            'alt_text' => $image->alt_text,
                            'is_primary' => $image->is_primary,
                            'sort_order' => $image->sort_order,
                        ])->values(),
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

    private function imageUrl(Request $request, string $imageUrl): string
    {
        if (Str::startsWith($imageUrl, ['http://', 'https://'])) {
            return $imageUrl;
        }

        $path = ltrim($imageUrl, '/');
        $path = Str::startsWith($path, 'storage/') ? $path : 'storage/'.$path;

        return $request->getSchemeAndHttpHost().'/'.$path;
    }
}
