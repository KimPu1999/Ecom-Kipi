<?php

namespace App\Http\Controllers\Api\V1;

use App\Support\ApiResponse;

class PaymentMethodController
{
    public function manual()
    {
        $methods = collect(config('payment_receipts.providers', []))
            ->map(fn (array $provider, string $code) => [
                'code' => $code,
                'label' => $provider['label'],
                'recipient_name' => $provider['recipient_name'],
                'recipient_phone' => $provider['recipient_phone'],
                'qr_url' => $provider['qr_url'] ?? null,
            ])
            ->values();

        return ApiResponse::success($methods, 'Manual payment methods retrieved');
    }
}
