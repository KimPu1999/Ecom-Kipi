<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Relations\BelongsTo;

class SellerPayoutStatusHistory extends Model
{
    protected $table = 'seller_payout_status_history';

    protected $fillable = ['seller_payout_id', 'actor_id', 'from_status', 'to_status', 'note', 'provider_reference'];

    public function payout(): BelongsTo
    {
        return $this->belongsTo(SellerPayout::class, 'seller_payout_id');
    }

    public function actor(): BelongsTo
    {
        return $this->belongsTo(User::class, 'actor_id');
    }
}
