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
        $orders = $request->user()->orders()->with(['items.seller', 'items.variant.product.images', 'sellerOrders.seller'])->latest()->paginate(20);

        return ApiResponse::paginated($orders, OrderResource::collection($orders->items()), 'Orders retrieved');
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
