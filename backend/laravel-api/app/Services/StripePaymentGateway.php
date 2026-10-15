<?php

namespace App\Services;

use App\Contracts\PaymentGateway;
use App\Exceptions\PaymentGatewayUnavailable;
use App\Models\Order;
use Stripe\StripeClient;
use Stripe\Webhook;

class StripePaymentGateway implements PaymentGateway
{
    private function secret(): string
    {
        $secret = (string) config('commerce.stripe_secret');
        if ($secret === '') {
            throw new PaymentGatewayUnavailable('Stripe test-mode credentials are not configured.');
        }

        return $secret;
    }

    private function client(): StripeClient
    {
        return new StripeClient($this->secret());
    }

    public function initialize(Order $order, string $idempotencyKey): array
    {
        return $this->client()->paymentIntents->create([
            'amount' => $order->grand_total_minor,
            'currency' => strtolower($order->currency),
            'payment_method_types' => ['card'],
            'metadata' => [
                'order_id' => (string) $order->id,
                'order_number' => $order->order_number,
            ],
        ], ['idempotency_key' => $idempotencyKey])->toArray();
    }

    public function retrieve(string $providerPaymentId): array
    {
        return $this->client()->paymentIntents->retrieve($providerPaymentId)->toArray();
    }

    public function refund(string $providerPaymentId, int $amountMinor, string $currency, string $idempotencyKey): array
    {
        return $this->client()->refunds->create([
            'payment_intent' => $providerPaymentId,
            'amount' => $amountMinor,
        ], ['idempotency_key' => $idempotencyKey])->toArray();
    }

    public function verifyWebhook(string $payload, string $signature): array
    {
        $secret = (string) config('commerce.stripe_webhook_secret');
        if ($secret === '') {
            throw new PaymentGatewayUnavailable('Stripe webhook secret is not configured.');
        }
        try {
            return Webhook::constructEvent(
                $payload,
                $signature,
                $secret,
                (int) config('commerce.webhook_tolerance_seconds', 300),
            )->toArray();
        } catch (\Throwable $exception) {
            throw new \InvalidArgumentException('Invalid payment webhook signature or payload.', 0, $exception);
        }
    }
}
