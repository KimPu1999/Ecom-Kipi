<?php

namespace App\Services;

use App\Models\AuditLog;
use App\Models\Payment;
use App\Models\User;
use Illuminate\Http\UploadedFile;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Str;
use Illuminate\Validation\ValidationException;

class PaymentReceiptService
{
    private const MANUAL_PROVIDERS = ['kbzpay', 'ayapay', 'wavepay', 'bank_transfer'];

    public function submit(Payment $payment, User $customer, array $data, UploadedFile $file, string $ip): Payment
    {
        return DB::transaction(function () use ($payment, $customer, $data, $file, $ip): Payment {
            $payment = Payment::query()->whereKey($payment->id)->lockForUpdate()->with('order')->firstOrFail();
            if ($payment->order->user_id !== $customer->id) {
                abort(404);
            }
            $this->assertManualPayment($payment);
            if ($payment->status === 'paid') {
                throw ValidationException::withMessages(['receipt' => 'This payment has already been verified.']);
            }

            $metadata = $payment->metadata ?? [];
            $existingReceipt = is_array($metadata['receipt'] ?? null) ? $metadata['receipt'] : [];
            if (($existingReceipt['status'] ?? null) === 'submitted') {
                return $payment->fresh();
            }

            if ($existingReceipt !== []) {
                $metadata['receipt_history'] = array_merge($metadata['receipt_history'] ?? [], [$existingReceipt]);
            }

            $path = $file->store('payment-receipts/'.$payment->order_id, config('payment_receipts.disk', 'local'));
            if (! $path) {
                throw ValidationException::withMessages(['receipt' => 'The receipt could not be stored. Please try again.']);
            }

            $now = now()->toISOString();
            $metadata['sender_name'] = trim($data['sender_name']);
            if (filled($data['sender_phone'] ?? null)) {
                $metadata['sender_phone'] = trim($data['sender_phone']);
            }
            if (filled($data['transaction_code'] ?? null)) {
                $metadata['transaction_code'] = trim($data['transaction_code']);
            }
            $metadata['collection_status'] = 'awaiting_admin_verification';
            $metadata['receipt'] = [
                'status' => 'submitted',
                'storage_path' => $path,
                'mime_type' => $file->getMimeType(),
                'size' => $file->getSize(),
                'sha256' => hash_file('sha256', $file->getRealPath()),
                'submitted_at' => $now,
                'submitted_by' => $customer->id,
                'reviewed_at' => null,
                'reviewed_by' => null,
                'rejection_reason' => null,
            ];
            $payment->update(['metadata' => $metadata]);

            $this->audit($customer->id, 'payment.receipt_submitted', $payment, $ip, ['status' => 'submitted']);

            return $payment->fresh();
        });
    }

    public function approve(Payment $payment, User $reviewer, PaymentService $payments, string $ip): Payment
    {
        return DB::transaction(function () use ($payment, $reviewer, $payments, $ip): Payment {
            $payment = Payment::query()->whereKey($payment->id)->lockForUpdate()->with('order')->firstOrFail();
            $this->assertManualPayment($payment);
            $metadata = $payment->metadata ?? [];
            $receipt = is_array($metadata['receipt'] ?? null) ? $metadata['receipt'] : [];
            if (($receipt['status'] ?? null) === 'approved' && $payment->status === 'paid') {
                return $payment->fresh();
            }
            if (($receipt['status'] ?? null) !== 'submitted') {
                throw ValidationException::withMessages(['receipt' => 'Only a submitted receipt can be approved.']);
            }

            $payment = $payments->verifyManual($payment, $reviewer->id);
            $metadata = $payment->metadata ?? [];
            $metadata['receipt'] = array_merge($receipt, [
                'status' => 'approved',
                'reviewed_at' => now()->toISOString(),
                'reviewed_by' => $reviewer->id,
                'rejection_reason' => null,
            ]);
            $payment->update(['metadata' => $metadata]);
            $this->audit($reviewer->id, 'payment.receipt_approved', $payment, $ip, ['status' => 'approved']);

            return $payment->fresh();
        });
    }

    public function reject(Payment $payment, User $reviewer, string $reason, string $ip): Payment
    {
        return DB::transaction(function () use ($payment, $reviewer, $reason, $ip): Payment {
            $payment = Payment::query()->whereKey($payment->id)->lockForUpdate()->with('order')->firstOrFail();
            $this->assertManualPayment($payment);
            if ($payment->status === 'paid') {
                throw ValidationException::withMessages(['receipt' => 'A paid payment cannot be rejected.']);
            }
            $metadata = $payment->metadata ?? [];
            $receipt = is_array($metadata['receipt'] ?? null) ? $metadata['receipt'] : [];
            if (($receipt['status'] ?? null) === 'rejected') {
                return $payment->fresh();
            }
            if (($receipt['status'] ?? null) !== 'submitted') {
                throw ValidationException::withMessages(['receipt' => 'Only a submitted receipt can be rejected.']);
            }
            $metadata['receipt'] = array_merge($receipt, [
                'status' => 'rejected',
                'reviewed_at' => now()->toISOString(),
                'reviewed_by' => $reviewer->id,
                'rejection_reason' => trim($reason),
            ]);
            $metadata['collection_status'] = 'receipt_rejected';
            $payment->update(['metadata' => $metadata]);
            $this->audit($reviewer->id, 'payment.receipt_rejected', $payment, $ip, ['status' => 'rejected', 'reason' => trim($reason)]);

            return $payment->fresh();
        });
    }

    public function path(Payment $payment): ?string
    {
        $receipt = data_get($payment->metadata, 'receipt');
        return is_array($receipt) && is_string($receipt['storage_path'] ?? null) ? $receipt['storage_path'] : null;
    }

    private function assertManualPayment(Payment $payment): void
    {
        if (! in_array($payment->provider, self::MANUAL_PROVIDERS, true)) {
            throw ValidationException::withMessages(['payment' => 'Receipts are only supported for configured manual payment providers.']);
        }
    }

    private function audit(int $actorId, string $action, Payment $payment, string $ip, array $after): void
    {
        AuditLog::query()->create([
            'actor_user_id' => $actorId,
            'action' => $action,
            'resource_type' => Payment::class,
            'resource_id' => $payment->id,
            'ip_address' => $ip,
            'request_id' => Str::uuid(),
            'before' => null,
            'after' => $after,
        ]);
    }
}
