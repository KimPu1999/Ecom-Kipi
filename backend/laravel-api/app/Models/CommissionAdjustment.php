<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Relations\BelongsTo;

class CommissionAdjustment extends Model
{
    protected $fillable = [
        'order_commission_id', 'seller_order_id', 'seller_order_item_id', 'refund_id',
        'type', 'amount_minor', 'currency', 'idempotency_key', 'created_by', 'metadata',
    ];

    protected function casts(): array
    {
        return ['amount_minor' => 'integer', 'metadata' => 'array'];
    }

    public function orderCommission(): BelongsTo
    {
        return $this->belongsTo(OrderCommission::class);
    }

    public function sellerOrder(): BelongsTo
    {
        return $this->belongsTo(SellerOrder::class);
    }

    public function sellerOrderItem(): BelongsTo
    {
        return $this->belongsTo(SellerOrderItem::class);
    }

    public function refund(): BelongsTo
    {
        return $this->belongsTo(Refund::class);
    }

    public function createdBy(): BelongsTo
    {
        return $this->belongsTo(User::class, 'created_by');
    }
}
