<?php

namespace App\Http\Controllers\Api\V1;

use App\Http\Controllers\Controller;
use App\Models\ShippingMethod;
use App\Support\ApiResponse;
use Illuminate\Http\Request;

class ShippingController extends Controller
{
    public function methods()
    {
        return ApiResponse::success(ShippingMethod::query()->where('is_active', true)->orderBy('sort_order')->get(), 'Shipping methods retrieved');
    }

    public function shipments(Request $request, int $id)
    {
        $order = $request->user()->orders()->findOrFail($id);

        return ApiResponse::success($order->shipments()->with(['items.orderItem', 'tracking', 'method'])->latest()->get(), 'Shipments retrieved');
    }

    public function tracking(Request $request, int $id)
    {
        $shipment = $request->user()->orders()->whereHas('shipments', fn ($query) => $query->whereKey($id))->firstOrFail()->shipments()->with('tracking')->findOrFail($id);

        return ApiResponse::success($shipment->tracking, 'Shipment tracking retrieved');
    }
}
