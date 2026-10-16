<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Relations\BelongsTo;

class OrderCommission extends Model
{
    protected $fillable = ['seller_order_id', 'seller_order_item_id', 'seller_id', 'brand_id', 'commission_rule_id', 'rule_source', 'status', 'confirmed_at', 'percentage_bps', 'fixed_minor', 'gross_minor', 'commission_minor', 'net_minor', 'currency', 'snapshot'];

    protected function casts(): array
    {
        return ['snapshot' => 'array', 'confirmed_at' => 'datetime'];
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

    public function seller(): BelongsTo
    {
        return $this->belongsTo(Seller::class);
    }

    public function brand(): BelongsTo
    {
        return $this->belongsTo(Brand::class);
    }
}
