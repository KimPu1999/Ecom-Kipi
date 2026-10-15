<?php

namespace App\Contracts;

use App\Models\Order;

interface PaymentGateway
{
    public function initialize(Order $order, string $idempotencyKey): array;

    public function retrieve(string $providerPaymentId): array;

    public function refund(string $providerPaymentId, int $amountMinor, string $currency, string $idempotencyKey): array;

    public function verifyWebhook(string $payload, string $signature): array;
}
