<?php

namespace App\Services;

use App\Contracts\PaymentGateway;
use App\Jobs\SendOrderPushNotification;
use App\Models\Order;
use App\Models\Payment;
use App\Models\PaymentEvent;
use App\Models\PaymentWebhookEvent;
use App\Notifications\OrderPaidNotification;
use App\Notifications\PaymentConfirmedInAppNotification;
use Illuminate\Support\Facades\DB;
use Illuminate\Validation\ValidationException;
use RuntimeException;

class PaymentService
{
    public function __construct(
        private readonly PaymentGateway $gateway,
        private readonly InventoryReservationService $reservations,
        private readonly MarketplaceOrderService $marketplace,
    ) {}

    public function initialize(Order $order, int $userId, string $idempotencyKey): array
    {
        if ($order->user_id !== $userId) {
            abort(404);
        }
        if ($order->payment_status === 'paid') {
            throw ValidationException::withMessages(['payment' => 'This order has already been paid.']);
        }

        $payment = Payment::query()->firstOrCreate([
            'order_id' => $order->id,
            'provider' => 'stripe',
            'amount_minor' => $order->grand_total_minor,
            'currency' => $order->currency,
        ], [
            'status' => 'pending',
            'metadata' => ['order_number' => $order->order_number],
        ]);
        $existing = $payment->attempts()->where('idempotency_key', $idempotencyKey)->first();
        if ($existing) {
            $clientSecret = null;
            if ($existing->provider_payment_id) {
                try {
                    $clientSecret = $this->gateway->retrieve($existing->provider_payment_id)['client_secret'] ?? null;
                } catch (\Throwable) {
                    // The original attempt remains authoritative when a status retry is unavailable.
                }
            }

            return ['payment' => $payment->fresh(), 'attempt' => $existing, 'client_secret' => $clientSecret];
        }
        $attempt = $payment->attempts()->create([
            'attempt_number' => $payment->attempts()->count() + 1,
            'idempotency_key' => $idempotencyKey,
            'status' => 'processing',
        ]);

        try {
            $intent = $this->gateway->initialize($order, $idempotencyKey);
            $attempt->update(['status' => $this->mapStatus($intent['status'] ?? 'pending'), 'provider_payment_id' => $intent['id'] ?? null]);
            $payment->update(['provider_payment_id' => $intent['id'] ?? null, 'status' => $this->mapStatus($intent['status'] ?? 'pending')]);

            return ['payment' => $payment->fresh(), 'attempt' => $attempt->fresh(), 'client_secret' => $intent['client_secret'] ?? null];
        } catch (\Throwable $exception) {
            $attempt->update(['status' => 'failed', 'failure_message' => $exception->getMessage()]);
            $payment->update(['status' => 'failed', 'failure_message' => $exception->getMessage()]);
            throw $exception;
        }
    }

    public function status(Payment $payment, int $userId): array
    {
        if ($payment->order->user_id !== $userId) {
            abort(404);
        }
        if ($payment->provider_payment_id) {
            $remote = $this->gateway->retrieve($payment->provider_payment_id);
            DB::transaction(fn () => $this->applyIntent($payment, $remote));
        }

        return ['payment' => $payment->fresh(), 'order' => $payment->order->fresh()];
    }

    public function reconcile(Payment $payment): void
    {
        if ($payment->provider_payment_id) {
            $remote = $this->gateway->retrieve($payment->provider_payment_id);
            DB::transaction(fn () => $this->applyIntent($payment, $remote));
        }
    }

    public function collectCod(Payment $payment, int $collectorId): Payment
    {
        return DB::transaction(function () use ($payment, $collectorId): Payment {
            $payment = Payment::query()->whereKey($payment->id)->lockForUpdate()->with('order')->firstOrFail();
            if ($payment->provider !== 'cod') {
                throw ValidationException::withMessages(['payment' => 'Only COD payments can be collected here.']);
            }
            if ($payment->status !== 'paid') {
                $order = $payment->order()->lockForUpdate()->firstOrFail();
                $this->reservations->commitOrder($order, $order->user_id);
                $payment->update(['status' => 'paid', 'paid_at' => now(), 'metadata' => array_merge($payment->metadata ?? [], ['collection_status' => 'collected', 'collected_by' => $collectorId])]);
                $order->update(['payment_status' => 'paid', 'fulfillment_status' => 'confirmed']);
                $this->marketplace->markPaid($order);
                $order->statusHistory()->create(['status_type' => 'payment', 'from_status' => 'pending', 'to_status' => 'paid', 'changed_by' => $collectorId, 'note' => 'Cash on delivery collected.']);
            }

            return $payment->fresh();
        });
    }

    public function handleWebhook(string $provider, string $payload, string $signature): void
    {
        if ($provider !== 'stripe') {
            abort(404);
        }
        $event = $this->gateway->verifyWebhook($payload, $signature);
        $webhook = PaymentWebhookEvent::query()->firstOrCreate(
            ['provider' => $provider, 'provider_event_id' => $event['id']],
            ['status' => 'received', 'payload' => $event],
        );
        if ($webhook->status === 'processed') {
            return;
        }
        try {
            DB::transaction(function () use ($event, $provider, $webhook) {
                $object = $event['data']['object'];
                $payment = Payment::query()->where('provider', $provider)->where('provider_payment_id', $object['id'] ?? null)->first();
                $paymentEvent = PaymentEvent::query()->firstOrCreate([
                    'provider_event_id' => $event['id'],
                ], [
                    'payment_id' => $payment?->id,
                    'provider' => $provider,
                    'event_type' => $event['type'],
                    'payload' => $event,
                ]);
                if ($payment) {
                    $this->applyIntent($payment, $object);
                    $paymentEvent->update(['processed_at' => now()]);
                }
                $webhook->update(['status' => 'processed', 'processed_at' => now()]);
            });
        } catch (\Throwable $exception) {
            $webhook->update(['status' => 'failed', 'error' => $exception->getMessage()]);
            throw $exception;
        }
    }

    private function applyIntent(Payment $payment, array $intent): void
    {
        $status = $this->mapStatus($intent['status'] ?? 'pending');
        $amount = (int) ($intent['amount_received'] ?? $intent['amount'] ?? 0);
        if ($amount !== $payment->amount_minor || strtolower((string) ($intent['currency'] ?? '')) !== strtolower($payment->currency)) {
            throw new RuntimeException('Payment amount or currency does not match the order.');
        }
        if ($payment->status === 'paid' && $status !== 'paid') {
            return;
        }
        $payment->update([
            'status' => $status,
            'failure_code' => data_get($intent, 'last_payment_error.code'),
            'failure_message' => data_get($intent, 'last_payment_error.message'),
            'paid_at' => $status === 'paid' ? ($payment->paid_at ?? now()) : $payment->paid_at,
        ]);
        $order = $payment->order()->lockForUpdate()->first();
        if ($order && $status === 'paid' && $order->payment_status !== 'paid') {
            $this->reservations->commitOrder($order, $order->user_id);
            $order->update(['payment_status' => 'paid', 'fulfillment_status' => 'confirmed']);
            $this->marketplace->markPaid($order);
            $order->statusHistory()->create(['status_type' => 'payment', 'from_status' => 'pending', 'to_status' => 'paid', 'note' => 'Payment verified by Stripe.']);
            if ($order->user) {
                $order->user->notify(new PaymentConfirmedInAppNotification($order->fresh()));
                DB::afterCommit(fn () => $order->user->notify(new OrderPaidNotification($order->fresh())));
                if (! app()->environment('testing')) {
                    DB::afterCommit(fn () => SendOrderPushNotification::dispatch($order->fresh(), 'payment_confirmed', 'Payment confirmed for your order.'));
                }
            }
        } elseif ($order && in_array($status, ['failed', 'canceled'], true) && $order->payment_status !== 'paid') {
            $order->update(['payment_status' => 'failed']);
        } elseif ($order && $status === 'processing') {
            $order->update(['payment_status' => 'processing']);
        }
    }

    private function mapStatus(string $status): string
    {
        return match ($status) {
            'succeeded' => 'paid',
            'processing' => 'processing',
            'requires_payment_method', 'canceled' => 'failed',
            default => 'pending',
        };
    }
}
