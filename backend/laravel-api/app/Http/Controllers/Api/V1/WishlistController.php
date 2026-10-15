<?php

namespace App\Http\Controllers\Api\V1;

use App\Http\Controllers\Controller;
use App\Http\Resources\ProductResource;
use App\Models\Product;
use App\Models\Seller;
use App\Support\ApiResponse;
use Illuminate\Http\Request;

class WishlistController extends Controller
{
    public function index(Request $request)
    {
        $wishlist = $request->user()->wishlist()->firstOrCreate([]);
        $items = $wishlist->items()->with(['product.category', 'product.brand', 'product.seller', 'product.images', 'product.variants.inventory'])->latest()->get();
        $products = $items->pluck('product')->filter();

        return ApiResponse::success([
            'products' => ProductResource::collection($products),
            'product_ids' => $products->pluck('id')->values(),
        ], 'Wishlist retrieved');
    }

    public function store(Request $request, Product $product)
    {
        abort_unless($product->status === 'published' && (! $product->seller_id || in_array($product->seller?->status, [Seller::STATUS_APPROVED, 'active'], true)), 404);
        $wishlist = $request->user()->wishlist()->firstOrCreate([]);
        $wishlist->items()->firstOrCreate(['product_id' => $product->id]);

        return ApiResponse::success(null, 'Product added to wishlist', 201);
    }

    public function destroy(Request $request, Product $product)
    {
        $wishlist = $request->user()->wishlist()->first();
        $wishlist?->items()->where('product_id', $product->id)->delete();

        return ApiResponse::success(null, 'Product removed from wishlist');
    }

    public function clear(Request $request)
    {
        $request->user()->wishlist()->first()?->items()->delete();

        return ApiResponse::success(null, 'Wishlist cleared');
    }
}
