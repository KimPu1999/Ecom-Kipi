<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Relations\BelongsTo;

class SellerLedgerEntry extends Model
{
    protected $fillable = ['seller_id', 'seller_order_id', 'payout_id', 'type', 'amount_minor', 'currency', 'reference_type', 'reference_id', 'idempotency_key', 'metadata', 'occurred_at'];

    protected function casts(): array
    {
        return ['metadata' => 'array', 'occurred_at' => 'datetime'];
    }

    public function seller(): BelongsTo
    {
        return $this->belongsTo(Seller::class);
    }

    public function sellerOrder(): BelongsTo
    {
        return $this->belongsTo(SellerOrder::class);
    }

    public function payout(): BelongsTo
    {
        return $this->belongsTo(SellerPayout::class, 'payout_id');
    }
}
