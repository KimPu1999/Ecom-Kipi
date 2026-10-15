<?php

namespace App\Http\Controllers\Api\V1\Catalog;

use App\Http\Controllers\Controller;
use App\Http\Resources\BrandResource;
use App\Http\Resources\CategoryResource;
use App\Http\Resources\ProductResource;
use App\Models\Brand;
use App\Models\Category;
use App\Models\Product;
use App\Models\Seller;
use App\Support\ApiResponse;
use Illuminate\Http\Request;

class CatalogController extends Controller
{
    public function categories()
    {
        return ApiResponse::success(CategoryResource::collection(Category::query()->where('is_active', true)->orderBy('sort_order')->get()), 'Categories retrieved');
    }

    public function category(string $slug)
    {
        $category = Category::query()->where('slug', $slug)->where('is_active', true)->firstOrFail();

        return ApiResponse::success(new CategoryResource($category), 'Category retrieved');
    }

    public function brands()
    {
        return ApiResponse::success(BrandResource::collection(Brand::query()->where('is_active', true)->orderBy('name')->get()), 'Brands retrieved');
    }

    public function brand(string $slug)
    {
        $brand = Brand::query()->where('slug', $slug)->where('is_active', true)->firstOrFail();

        return ApiResponse::success(new BrandResource($brand), 'Brand retrieved');
    }

    public function products(Request $request)
    {
        $query = Product::query()->published()->with(['category', 'brand', 'seller', 'images', 'variants.inventory'])
            ->where(fn ($sellerQuery) => $sellerQuery->whereNull('seller_id')->orWhereHas('seller', fn ($seller) => $seller->whereIn('status', [Seller::STATUS_APPROVED, 'active'])));
        $query->when($request->filled('q'), fn ($q) => $q->where(fn ($inner) => $inner->where('name', 'like', '%'.$request->string('q').'%')->orWhere('description', 'like', '%'.$request->string('q').'%')));
        $query->when($request->filled('category'), fn ($q) => $q->whereHas('category', fn ($c) => $c->where('slug', $request->string('category'))));
        $query->when($request->filled('brand'), fn ($q) => $q->whereHas('brand', fn ($b) => $b->where('slug', $request->string('brand'))));
        $query->when($request->filled('min_price'), fn ($q) => $q->whereHas('variants', fn ($v) => $v->where('price_minor', '>=', (int) $request->input('min_price'))));
        $query->when($request->filled('max_price'), fn ($q) => $q->whereHas('variants', fn ($v) => $v->where('price_minor', '<=', (int) $request->input('max_price'))));
        $query->when($request->boolean('available'), fn ($q) => $q->whereHas('variants.inventory', fn ($i) => $i->whereColumn('quantity', '>', 'reserved_quantity')));
        $query->when($request->boolean('featured'), fn ($q) => $q->where('is_featured', true));
        $sort = $request->input('sort', 'latest');
        if ($sort === 'name') {
            $query->orderBy('name');
        } elseif ($sort === 'price_asc') {
            $query->orderBy(
                Product::query()->select('price_minor')
                    ->from('product_variants')
                    ->whereColumn('product_variants.product_id', 'products.id')
                    ->orderBy('price_minor')
                    ->limit(1)
            );
        } elseif ($sort === 'price_desc') {
            $query->orderByDesc(
                Product::query()->select('price_minor')
                    ->from('product_variants')
                    ->whereColumn('product_variants.product_id', 'products.id')
                    ->orderByDesc('price_minor')
                    ->limit(1)
            );
        } else {
            $query->latest();
        }
        $products = $query->paginate(min((int) $request->input('per_page', 20), 100))->withQueryString();

        return ApiResponse::paginated($products, ProductResource::collection($products->items()), 'Products retrieved');
    }

    public function featured()
    {
        $products = Product::query()->published()->where('is_featured', true)->with(['category', 'brand', 'seller', 'images', 'variants.inventory'])->where(fn ($sellerQuery) => $sellerQuery->whereNull('seller_id')->orWhereHas('seller', fn ($seller) => $seller->whereIn('status', [Seller::STATUS_APPROVED, 'active'])))->latest()->paginate(20);

        return ApiResponse::paginated($products, ProductResource::collection($products->items()), 'Featured products retrieved');
    }

    public function product(string $slug)
    {
        $product = Product::query()->published()->where('slug', $slug)->with(['category', 'brand', 'seller', 'images', 'variants.inventory'])->where(fn ($sellerQuery) => $sellerQuery->whereNull('seller_id')->orWhereHas('seller', fn ($seller) => $seller->whereIn('status', [Seller::STATUS_APPROVED, 'active'])))->firstOrFail();

        return ApiResponse::success(new ProductResource($product), 'Product retrieved');
    }
}
