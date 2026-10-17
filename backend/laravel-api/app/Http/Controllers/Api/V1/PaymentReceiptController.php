<?php

namespace App\Http\Controllers\Api\V1;

use App\Http\Requests\Api\V1\PaymentReceiptRequest;
use App\Http\Requests\Api\V1\RejectPaymentReceiptRequest;
use App\Http\Resources\PaymentReceiptResource;
use App\Http\Resources\PaymentResource;
use App\Models\Order;
use App\Models\Payment;
use App\Services\PaymentReceiptService;
use App\Services\PaymentService;
use App\Support\ApiResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Storage;
use Illuminate\Support\Str;

class PaymentReceiptController
{
    public function manualMethods()
    {
        return app(PaymentMethodController::class)->manual();
    }

    public function submit(PaymentReceiptRequest $request, Order $order, Payment $payment, PaymentReceiptService $receipts)
    {
        abort_unless($request->user()->orders()->whereKey($order->id)->exists(), 404);
        abort_unless($payment->order_id === $order->id, 404);

        $payment = $receipts->submit($payment, $request->user(), $request->validated(), $request->file('receipt'), $request->ip());

        return ApiResponse::success(new PaymentResource($payment), 'Payment receipt submitted for review');
    }

    public function index(Request $request)
    {
        $query = Payment::query()
            ->with(['order.user'])
            ->whereIn('provider', ['kbzpay', 'ayapay', 'wavepay', 'bank_transfer'])
            ->where('metadata->receipt->status', 'submitted')
            ->latest('updated_at');
        $payments = $query->paginate(min($request->integer('per_page', 20), 100));

        return ApiResponse::paginated($payments, PaymentReceiptResource::collection($payments->items()), 'Payment receipts retrieved');
    }

    public function file(Payment $payment, PaymentReceiptService $receipts)
    {
        $path = $receipts->path($payment);
        abort_unless($path && Str::startsWith($path, 'payment-receipts/') && ! Str::contains($path, '..'), 404);

        $diskName = config('payment_receipts.disk', 'local');
        $disk = Storage::disk($diskName);
        abort_unless($disk->exists($path), 404);

        if ($diskName !== 'local' && method_exists($disk, 'temporaryUrl')) {
            return redirect()->away($disk->temporaryUrl($path, now()->addMinutes(5)));
        }

        return response()->file($disk->path($path), [
            'Content-Type' => $disk->mimeType($path) ?: 'application/octet-stream',
            'Content-Disposition' => 'inline; filename="payment-receipt-'.$payment->id.'"',
            'Cache-Control' => 'private, no-store',
        ]);
    }

    public function approve(Request $request, Payment $payment, PaymentReceiptService $receipts, PaymentService $payments)
    {
        $payment = $receipts->approve($payment, $request->user(), $payments, $request->ip());

        return ApiResponse::success(new PaymentResource($payment), 'Payment receipt approved and payment verified');
    }

    public function reject(RejectPaymentReceiptRequest $request, Payment $payment, PaymentReceiptService $receipts)
    {
        $payment = $receipts->reject($payment, $request->user(), $request->validated()['rejection_reason'], $request->ip());

        return ApiResponse::success(new PaymentResource($payment), 'Payment receipt rejected');
    }
}
