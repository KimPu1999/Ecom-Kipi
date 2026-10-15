<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;

class SellerPayout extends Model
{
    protected $fillable = ['seller_id', 'status', 'amount_minor', 'currency', 'provider', 'provider_payout_id', 'idempotency_key', 'failure_message', 'requested_at', 'processed_at'];

    protected function casts(): array
    {
        return ['requested_at' => 'datetime', 'processed_at' => 'datetime'];
    }

    public function seller(): BelongsTo
    {
        return $this->belongsTo(Seller::class);
    }

    public function items(): HasMany
    {
        return $this->hasMany(SellerPayoutItem::class);
    }

    public function reconciliation(): HasMany
    {
        return $this->hasMany(PayoutReconciliationRecord::class);
    }
}
