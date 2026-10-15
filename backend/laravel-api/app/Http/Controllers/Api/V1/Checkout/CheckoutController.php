<?php

namespace App\Http\Controllers\Api\V1\Checkout;

use App\Http\Controllers\Controller;
use App\Http\Requests\Api\V1\CheckoutConfirmRequest;
use App\Services\CheckoutService;
use App\Services\PricingService;
use App\Support\ApiResponse;
use Illuminate\Http\Request;

class CheckoutController extends Controller
{
    public function preview(Request $request, PricingService $pricing)
    {
        $result = $pricing->calculate($request->user(), $request->integer('shipping_method_id') ?: null, $request->string('coupon_code')->toString() ?: null);

        return ApiResponse::success([
            'lines' => $result['lines'],
            'shipping_method' => $result['shipping_method'],
            'subtotal_minor' => $result['subtotal_minor'],
            'discount_minor' => $result['discount_minor'],
            'shipping_minor' => $result['shipping_minor'],
            'tax_minor' => $result['tax_minor'],
            'grand_total_minor' => $result['grand_total_minor'],
            'currency' => $result['currency'],
            'item_count' => $result['item_count'],
            'coupon_code' => $result['coupon_code'],
        ], 'Checkout preview retrieved');
    }

    public function confirm(CheckoutConfirmRequest $request, CheckoutService $checkout)
    {
        return ApiResponse::success($checkout->confirm($request->user(), $request->validated()), 'Checkout confirmed', 201);
    }
}
