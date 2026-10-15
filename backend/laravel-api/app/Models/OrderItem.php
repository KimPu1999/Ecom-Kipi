<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Relations\BelongsTo;

class OrderItem extends Model
{
    protected $fillable = [
        'order_id', 'product_variant_id', 'product_name', 'sku',
        'quantity', 'unit_price_minor', 'line_total_minor', 'attributes', 'seller_id',
    ];

    protected function casts(): array
    {
        return ['attributes' => 'array'];
    }

    public function order(): BelongsTo
    {
        return $this->belongsTo(Order::class);
    }

    public function variant(): BelongsTo
    {
        return $this->belongsTo(ProductVariant::class, 'product_variant_id');
    }

    public function seller(): BelongsTo
    {
        return $this->belongsTo(Seller::class);
    }
}
