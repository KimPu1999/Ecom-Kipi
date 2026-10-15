<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasOne;

class ProductVariant extends Model
{
    protected $fillable = [
        'product_id', 'sku', 'price_minor', 'compare_at_price_minor',
        'currency', 'attributes', 'is_active',
    ];

    protected function casts(): array
    {
        return ['attributes' => 'array', 'is_active' => 'boolean'];
    }

    public function product(): BelongsTo
    {
        return $this->belongsTo(Product::class);
    }

    public function inventory(): HasOne
    {
        return $this->hasOne(Inventory::class);
    }
}
