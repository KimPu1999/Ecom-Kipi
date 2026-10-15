<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Relations\BelongsTo;

class SellerRefundAllocation extends Model
{
    protected $fillable = ['refund_id', 'seller_order_id', 'seller_order_item_id', 'amount_minor', 'commission_reversed_minor', 'ledger_idempotency_key'];

    public function refund(): BelongsTo
    {
        return $this->belongsTo(Refund::class);
    }

    public function sellerOrder(): BelongsTo
    {
        return $this->belongsTo(SellerOrder::class);
    }

    public function item(): BelongsTo
    {
        return $this->belongsTo(SellerOrderItem::class, 'seller_order_item_id');
    }
}
