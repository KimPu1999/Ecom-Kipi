<?php

namespace App\Http\Resources;

use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;
use Illuminate\Support\Arr;

class PaymentResource extends JsonResource
{
    public function toArray(Request $request): array
    {
        $metadata = $this->metadata ?? [];
        $receipt = is_array($metadata['receipt'] ?? null) ? $metadata['receipt'] : [];
        $canManage = $request->user()?->hasPermission('manage_orders') ?? false;

        return [
            'id' => $this->id,
            'order_id' => $this->order_id,
            'provider' => $this->provider,
            'provider_payment_id' => $this->provider_payment_id,
            'status' => $this->status,
            'amount_minor' => $this->amount_minor,
            'currency' => $this->currency,
            'failure_message' => $this->failure_message,
            'paid_at' => $this->paid_at?->toISOString(),
            'metadata' => $canManage ? $this->safeMetadata($metadata) : null,
            'receipt' => [
                'status' => $receipt['status'] ?? 'not_submitted',
                'submitted_at' => $receipt['submitted_at'] ?? null,
                'reviewed_at' => $receipt['reviewed_at'] ?? null,
                'rejection_reason' => $receipt['rejection_reason'] ?? null,
                'has_file' => isset($receipt['storage_path']),
            ],
        ];
    }

    private function safeMetadata(array $metadata): array
    {
        if (isset($metadata['receipt']) && is_array($metadata['receipt'])) {
            $metadata['receipt'] = Arr::except($metadata['receipt'], ['storage_path', 'sha256']);
        }

        if (isset($metadata['receipt_history']) && is_array($metadata['receipt_history'])) {
            $metadata['receipt_history'] = array_map(
                fn (mixed $entry) => is_array($entry) ? Arr::except($entry, ['storage_path', 'sha256']) : $entry,
                $metadata['receipt_history'],
            );
        }

        return $metadata;
    }
}
