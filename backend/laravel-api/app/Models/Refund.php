<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;

class Refund extends Model
{
    protected $fillable = ['order_id', 'payment_id', 'requested_by', 'provider_ref', 'status', 'amount_minor', 'currency', 'reason', 'metadata', 'processed_at'];

    protected function casts(): array
    {
        return ['metadata' => 'array', 'processed_at' => 'datetime'];
    }

    public function order(): BelongsTo
    {
        return $this->belongsTo(Order::class);
    }

    public function payment(): BelongsTo
    {
        return $this->belongsTo(Payment::class);
    }

    public function requester(): BelongsTo
    {
        return $this->belongsTo(User::class, 'requested_by');
    }

    public function items(): HasMany
    {
        return $this->hasMany(RefundItem::class);
    }
}
