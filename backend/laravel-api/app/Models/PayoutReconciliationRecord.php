<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Relations\BelongsTo;

class PayoutReconciliationRecord extends Model
{
    protected $fillable = ['seller_payout_id', 'provider_reference', 'status', 'expected_minor', 'actual_minor', 'difference_minor', 'metadata', 'reconciled_at'];

    protected function casts(): array
    {
        return ['metadata' => 'array', 'reconciled_at' => 'datetime'];
    }

    public function payout(): BelongsTo
    {
        return $this->belongsTo(SellerPayout::class, 'seller_payout_id');
    }
}
