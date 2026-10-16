<?php

namespace App\Http\Resources;

use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;
use Illuminate\Support\Str;

class ProductResource extends JsonResource
{
    public function toArray(Request $request): array
    {
        return [
            'id' => $this->id,
            'name' => $this->name,
            'slug' => $this->slug,
            'description' => $this->description,
            'status' => $this->status,
            'is_featured' => $this->is_featured,
            'average_rating' => isset($this->average_rating) ? round((float) $this->average_rating, 1) : null,
            'review_count' => isset($this->reviews_count) ? (int) $this->reviews_count : null,
            'category' => new CategoryResource($this->whenLoaded('category')),
            'brand' => new BrandResource($this->whenLoaded('brand')),
            'seller' => $this->whenLoaded('seller', fn () => $this->seller ? [
                'id' => $this->seller->id,
                'store_name' => $this->seller->store_name,
                'slug' => $this->seller->slug,
            ] : null),
            'images' => $this->whenLoaded('images', fn () => $this->images->map(fn ($image) => [
                'id' => $image->id,
                'url' => $this->imageUrl($request, $image->url),
                'alt_text' => $image->alt_text,
                'is_primary' => $image->is_primary,
                'sort_order' => $image->sort_order,
            ])),
            'variants' => $this->whenLoaded('variants', fn () => $this->variants->map(fn ($variant) => [
                'id' => $variant->id,
                'sku' => $variant->sku,
                'price_minor' => $variant->price_minor,
                'compare_at_price_minor' => $variant->compare_at_price_minor,
                'currency' => $variant->currency,
                'attributes' => $variant->attributes,
                'is_active' => $variant->is_active,
                'quantity' => $variant->inventory?->quantity,
                'reserved_quantity' => $variant->inventory?->reserved_quantity,
                'low_stock_threshold' => $variant->inventory?->low_stock_threshold,
                'available_quantity' => $variant->inventory?->availableQuantity(),
            ])),
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
