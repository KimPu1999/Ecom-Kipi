<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Relations\BelongsTo;

class OrderCommission extends Model
{
    protected $fillable = ['seller_order_id', 'seller_order_item_id', 'commission_rule_id', 'percentage_bps', 'fixed_minor', 'gross_minor', 'commission_minor', 'net_minor', 'currency', 'snapshot'];

    protected function casts(): array
    {
        return ['snapshot' => 'array'];
    }

    public function sellerOrder(): BelongsTo
    {
        return $this->belongsTo(SellerOrder::class);
    }

    public function item(): BelongsTo
    {
        return $this->belongsTo(SellerOrderItem::class, 'seller_order_item_id');
    }

    public function rule(): BelongsTo
    {
        return $this->belongsTo(CommissionRule::class, 'commission_rule_id');
    }
}
