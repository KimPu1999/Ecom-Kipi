<?php

namespace App\Http\Controllers\Api\V1\Admin;

use App\Http\Controllers\Controller;
use App\Http\Requests\Api\V1\AdminRefundRequest;
use App\Models\Order;
use App\Services\RefundService;
use App\Support\ApiResponse;

class RefundController extends Controller
{
    public function index(Order $order)
    {
        return ApiResponse::success($order->refunds()->latest()->get(), 'Refunds retrieved');
    }

    public function store(AdminRefundRequest $request, Order $order, RefundService $refunds)
    {
        return ApiResponse::success($refunds->create($order, $request->integer('amount_minor'), $request->string('reason')->toString(), $request->string('idempotency_key')->toString(), $request->user()->id), 'Refund processed', 201);
    }
}
