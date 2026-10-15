<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Relations\BelongsTo;

class RefundItem extends Model
{
    protected $fillable = ['refund_id', 'order_item_id', 'quantity', 'amount_minor'];

    public function refund(): BelongsTo
    {
        return $this->belongsTo(Refund::class);
    }

    public function orderItem(): BelongsTo
    {
        return $this->belongsTo(OrderItem::class);
    }
}
