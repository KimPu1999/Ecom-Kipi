<?php

namespace App\Http\Controllers\Api\V1;

use App\Exceptions\PaymentGatewayUnavailable;
use App\Http\Controllers\Controller;
use App\Http\Requests\Api\V1\PaymentInitializeRequest;
use App\Http\Requests\Api\V1\PaymentRetryRequest;
use App\Models\Payment;
use App\Services\PaymentService;
use App\Support\ApiResponse;
use Illuminate\Http\Request;
use Illuminate\Validation\ValidationException;

class PaymentController extends Controller
{
    public function initialize(PaymentInitializeRequest $request, PaymentService $payments)
    {
        $order = $request->user()->orders()->findOrFail($request->integer('order_id'));

        try {
            return ApiResponse::success($payments->initialize($order, $request->user()->id, $request->validated()['idempotency_key']), 'Payment initialized');
        } catch (PaymentGatewayUnavailable $exception) {
            return ApiResponse::error($exception->getMessage(), 503);
        }
    }

    public function status(Request $request, Payment $payment, PaymentService $payments)
    {
        return ApiResponse::success($payments->status($payment->load('order'), $request->user()->id), 'Payment status retrieved');
    }

    public function retry(PaymentRetryRequest $request, Payment $payment, PaymentService $payments)
    {
        $order = $payment->order;

        try {
            return ApiResponse::success($payments->initialize($order, $request->user()->id, $request->validated()['idempotency_key']), 'Payment retry initialized');
        } catch (PaymentGatewayUnavailable $exception) {
            return ApiResponse::error($exception->getMessage(), 503);
        }
    }

    public function collectCod(Request $request, Payment $payment, PaymentService $payments)
    {
        if ($payment->provider !== 'cod') {
            throw ValidationException::withMessages(['payment' => 'Only COD payments can be collected here.']);
        }
        if ($payment->status === 'paid') {
            return ApiResponse::success(['payment' => $payment->fresh(), 'order' => $payment->order->fresh()], 'COD payment already collected');
        }

        $payment = $payments->collectCod($payment, $request->user()->id);

        return ApiResponse::success(['payment' => $payment->fresh(), 'order' => $payment->order->fresh()], 'COD payment collected');
    }

    public function verifyManual(Request $request, Payment $payment, PaymentService $payments)
    {
        if (! in_array($payment->provider, ['kbzpay', 'wavepay', 'bank_transfer'], true)) {
            throw ValidationException::withMessages(['payment' => 'Only manual online payments can be verified here.']);
        }
        if ($payment->status === 'paid') {
            return ApiResponse::success(['payment' => $payment->fresh(), 'order' => $payment->order->fresh()], 'Manual payment already verified');
        }

        $payment = $payments->verifyManual($payment, $request->user()->id);

        return ApiResponse::success(['payment' => $payment->fresh(), 'order' => $payment->order->fresh()], 'Manual payment verified');
    }
}
