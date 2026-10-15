<?php

namespace App\Http\Controllers\Api\V1;

use App\Http\Controllers\Controller;
use App\Http\Requests\Api\V1\ProductReviewRequest;
use App\Models\Order;
use App\Models\Product;
use App\Models\ProductReview;
use App\Support\ApiResponse;
use Illuminate\Validation\ValidationException;

class ReviewController extends Controller
{
    public function index(Product $product)
    {
        abort_unless($product->status === 'published', 404);

        $reviews = $product->reviews()->where('status', 'approved')->with('user:id,name')->latest('published_at')->paginate(10);
        $summary = [
            'average_rating' => round((float) ($product->reviews()->where('status', 'approved')->avg('rating') ?? 0), 1),
            'review_count' => $product->reviews()->where('status', 'approved')->count(),
        ];

        return ApiResponse::success(['summary' => $summary, 'reviews' => $reviews->items()], 'Product reviews retrieved', 200, [
            'current_page' => $reviews->currentPage(),
            'per_page' => $reviews->perPage(),
            'last_page' => $reviews->lastPage(),
            'total' => $reviews->total(),
        ]);
    }

    public function store(ProductReviewRequest $request, Product $product)
    {
        abort_unless($product->status === 'published', 404);

        $order = Order::query()->where('user_id', $request->user()->id)->where('payment_status', 'paid')->whereHas('items.variant', fn ($query) => $query->where('product_id', $product->id))->latest()->first();
        if (! $order) {
            throw ValidationException::withMessages(['product' => 'You can review products after a paid purchase.']);
        }
        if (ProductReview::query()->where('product_id', $product->id)->where('user_id', $request->user()->id)->exists()) {
            throw ValidationException::withMessages(['review' => 'You have already reviewed this product.']);
        }

        $review = ProductReview::query()->create($request->validated() + [
            'product_id' => $product->id,
            'user_id' => $request->user()->id,
            'order_id' => $order->id,
            'status' => 'approved',
            'published_at' => now(),
        ]);

        return ApiResponse::success($review->load('user:id,name'), 'Review submitted', 201);
    }
}
