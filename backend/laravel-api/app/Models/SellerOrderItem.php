<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Relations\BelongsTo;

class SellerOrderItem extends Model
{
    protected $fillable = ['seller_order_id', 'order_item_id', 'product_variant_id', 'product_name', 'sku', 'quantity', 'unit_price_minor', 'line_total_minor'];

    public function sellerOrder(): BelongsTo
    {
        return $this->belongsTo(SellerOrder::class);
    }

    public function orderItem(): BelongsTo
    {
        return $this->belongsTo(OrderItem::class);
    }

    public function variant(): BelongsTo
    {
        return $this->belongsTo(ProductVariant::class, 'product_variant_id');
    }
}
