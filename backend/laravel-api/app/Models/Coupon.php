<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Relations\HasMany;

class Coupon extends Model
{
    protected $fillable = [
        'code', 'type', 'value', 'minimum_subtotal_minor', 'maximum_discount_minor',
        'usage_limit', 'usage_count', 'per_user_limit', 'starts_at', 'ends_at', 'is_active',
    ];

    protected function casts(): array
    {
        return ['starts_at' => 'datetime', 'ends_at' => 'datetime', 'is_active' => 'boolean'];
    }

    public function usages(): HasMany
    {
        return $this->hasMany(CouponUsage::class);
    }
}
