<?php

namespace App\Services;

use App\Contracts\PaymentGateway;
use App\Models\Order;
use App\Models\Refund;
use Illuminate\Support\Facades\DB;
use Illuminate\Validation\ValidationException;

class RefundService
{
    public function __construct(private readonly PaymentGateway $gateway) {}

    public function create(Order $order, int $amount, string $reason, string $key, int $adminId): Refund
    {
        $payment = $order->payments()->where('status', 'paid')->latest()->first();
        if (! $payment || ! $payment->provider_payment_id) {
            throw ValidationException::withMessages(['payment' => 'A verified paid payment is required for a refund.']);
        }
        $refunded = (int) $order->refunds()->whereIn('status', ['processing', 'succeeded'])->sum('amount_minor');
        if ($amount > $order->grand_total_minor - $refunded) {
            throw ValidationException::withMessages(['amount_minor' => 'Refund exceeds the remaining refundable amount.']);
        }
        $existing = $order->refunds()->where('metadata->idempotency_key', $key)->first();
        if ($existing) {
            return $existing;
        }
        $refund = DB::transaction(fn () => $order->refunds()->create([
            'payment_id' => $payment->id,
            'requested_by' => $adminId,
            'status' => 'processing',
            'amount_minor' => $amount,
            'currency' => $order->currency,
            'reason' => $reason ?: null,
            'metadata' => ['idempotency_key' => $key],
        ]));
        try {
            $result = $this->gateway->refund($payment->provider_payment_id, $amount, $order->currency, $key);
            $refund->update(['provider_ref' => $result['id'] ?? null, 'status' => 'succeeded', 'processed_at' => now()]);
            $payment->update(['status' => ($refunded + $amount) >= $order->grand_total_minor ? 'refunded' : 'partially_refunded']);

            return $refund->fresh();
        } catch (\Throwable $exception) {
            $refund->update(['status' => 'failed', 'metadata' => ['idempotency_key' => $key, 'error' => $exception->getMessage()]]);
            throw $exception;
        }
    }
}
