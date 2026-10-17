<?php

namespace App\Http\Controllers\Api\V1\Order;

use App\Http\Controllers\Controller;
use App\Http\Requests\Api\V1\OrderCreateRequest;
use App\Http\Resources\OrderResource;
use App\Services\CheckoutService;
use App\Services\OrderService;
use App\Support\ApiResponse;
use Illuminate\Http\Request;

class OrderController extends Controller
{
    public function __construct(private readonly OrderService $orders) {}

    public function store(OrderCreateRequest $request, CheckoutService $checkout)
    {
        $order = $checkout->confirm($request->user(), $request->validated());

        return ApiResponse::success(new OrderResource($order), 'Order created', 201);
    }

    public function index(Request $request)
    {
        $filters = $request->validate([
            'q' => ['nullable', 'string', 'max:120'],
            'fulfillment_status' => ['nullable', 'in:pending,confirmed,processing,shipped,delivered,cancelled'],
            'payment_status' => ['nullable', 'in:pending,paid,failed,cancelled,refunded'],
            'placed_from' => ['nullable', 'date'],
            'placed_to' => ['nullable', 'date', 'after_or_equal:placed_from'],
            'page' => ['nullable', 'integer', 'min:1'],
        ]);

        $baseQuery = $request->user()->orders();
        $baseQuery->when($filters['q'] ?? null, function ($builder, string $search) {
            $builder->where(function ($nested) use ($search) {
                $nested->where('order_number', 'like', '%'.$search.'%')
                    ->orWhereHas('items', fn ($items) => $items->where('product_name', 'like', '%'.$search.'%'));
            });
        });
        $baseQuery->when($filters['payment_status'] ?? null, fn ($builder, string $status) => $builder->where('payment_status', $status));
        $baseQuery->when($filters['placed_from'] ?? null, fn ($builder, string $date) => $builder->whereDate('placed_at', '>=', $date));
        $baseQuery->when($filters['placed_to'] ?? null, fn ($builder, string $date) => $builder->whereDate('placed_at', '<=', $date));

        $query = clone $baseQuery;
        $query->when($filters['fulfillment_status'] ?? null, fn ($builder, string $status) => $builder->where('fulfillment_status', $status));

        $summaryQuery = clone $baseQuery;
        $summary = [
            'all' => (clone $summaryQuery)->count(),
            'pending' => (clone $summaryQuery)->where('fulfillment_status', 'pending')->count(),
            'confirmed' => (clone $summaryQuery)->where('fulfillment_status', 'confirmed')->count(),
            'processing' => (clone $summaryQuery)->where('fulfillment_status', 'processing')->count(),
            'shipped' => (clone $summaryQuery)->where('fulfillment_status', 'shipped')->count(),
            'delivered' => (clone $summaryQuery)->where('fulfillment_status', 'delivered')->count(),
            'cancelled' => (clone $summaryQuery)->where('fulfillment_status', 'cancelled')->count(),
        ];

        $orders = $query->with(['items.seller', 'items.variant.product.images', 'sellerOrders.seller'])->latest()->paginate(20);

        return ApiResponse::paginated($orders, OrderResource::collection($orders->items()), 'Orders retrieved', ['summary' => $summary]);
    }

    public function show(Request $request, int $id)
    {
        $order = $request->user()->orders()->with(['items.seller', 'items.variant.product.images', 'sellerOrders.seller', 'sellerOrders.items', 'statusHistory', 'shippingMethod', 'payments', 'shipments.tracking'])->findOrFail($id);

        return ApiResponse::success(new OrderResource($order), 'Order retrieved');
    }

    public function cancel(Request $request, int $id)
    {
        $order = $request->user()->orders()->findOrFail($id);

        return ApiResponse::success(new OrderResource($this->orders->cancel($order, $request->user()->id)), 'Order cancelled');
    }
}
