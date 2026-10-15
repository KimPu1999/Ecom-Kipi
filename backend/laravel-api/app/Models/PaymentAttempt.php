<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Relations\BelongsTo;

class PaymentAttempt extends Model
{
    protected $fillable = ['payment_id', 'attempt_number', 'idempotency_key', 'status', 'provider_payment_id', 'provider_request_id', 'failure_code', 'failure_message'];

    public function payment(): BelongsTo
    {
        return $this->belongsTo(Payment::class);
    }
}
