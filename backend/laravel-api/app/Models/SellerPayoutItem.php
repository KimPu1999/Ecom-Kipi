<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Relations\BelongsTo;

class SellerPayoutItem extends Model
{
    protected $fillable = ['seller_payout_id', 'ledger_entry_id', 'amount_minor'];

    public function payout(): BelongsTo
    {
        return $this->belongsTo(SellerPayout::class, 'seller_payout_id');
    }

    public function ledgerEntry(): BelongsTo
    {
        return $this->belongsTo(SellerLedgerEntry::class, 'ledger_entry_id');
    }
}
