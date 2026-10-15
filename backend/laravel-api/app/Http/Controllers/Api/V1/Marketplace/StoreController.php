<?php

namespace App\Http\Controllers\Api\V1\Marketplace;

use App\Http\Controllers\Controller;
use App\Http\Resources\ProductResource;
use App\Models\Seller;
use App\Support\ApiResponse;
use Illuminate\Http\Request;

class StoreController extends Controller
{
    public function index()
    {
        return ApiResponse::success(Seller::approved()->withCount('products')->orderBy('store_name')->get([
            'id', 'store_name', 'slug', 'description', 'logo_path', 'banner_path', 'support_email', 'support_phone',
        ]), 'Stores retrieved');
    }

    public function show(string $slug, Request $request)
    {
        $seller = Seller::approved()->where('slug', $slug)->firstOrFail();
        $products = $seller->products()->published()->with(['category', 'brand', 'seller', 'images', 'variants.inventory'])->paginate(min((int) $request->input('per_page', 20), 100));

        return ApiResponse::success([
            'store' => $seller->only(['id', 'store_name', 'slug', 'description', 'logo_path', 'banner_path', 'support_email', 'support_phone']),
            'products' => ProductResource::collection($products->items()),
            'meta' => ['current_page' => $products->currentPage(), 'last_page' => $products->lastPage(), 'total' => $products->total()],
        ], 'Store retrieved');
    }
}
