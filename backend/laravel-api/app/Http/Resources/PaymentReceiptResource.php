<?php

namespace App\Http\Resources;

use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

class PaymentReceiptResource extends JsonResource
{
    public function toArray(Request $request): array
    {
        $metadata = $this->metadata ?? [];
        $receipt = is_array($metadata['receipt'] ?? null) ? $metadata['receipt'] : [];

        return [
            'payment_id' => $this->id,
            'order_id' => $this->order_id,
            'order_number' => $this->order?->order_number,
            'customer' => $this->order?->user ? [
                'id' => $this->order->user->id,
                'name' => $this->order->user->name,
                'email' => $this->order->user->email,
            ] : null,
            'provider' => $this->provider,
            'amount_minor' => $this->amount_minor,
            'currency' => $this->currency,
            'sender_name' => $metadata['sender_name'] ?? null,
            'sender_phone' => $metadata['sender_phone'] ?? null,
            'transaction_code' => $metadata['transaction_code'] ?? null,
            'status' => $receipt['status'] ?? 'not_submitted',
            'submitted_at' => $receipt['submitted_at'] ?? null,
            'reviewed_at' => $receipt['reviewed_at'] ?? null,
            'rejection_reason' => $receipt['rejection_reason'] ?? null,
            'has_file' => isset($receipt['storage_path']),
        ];
    }
}
