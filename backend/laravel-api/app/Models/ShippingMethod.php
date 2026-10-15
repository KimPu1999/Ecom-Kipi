<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Relations\HasMany;

class ShippingMethod extends Model
{
    protected $fillable = ['code', 'name', 'description', 'price_minor', 'currency', 'is_active', 'sort_order'];

    protected function casts(): array
    {
        return ['is_active' => 'boolean'];
    }

    public function shipments(): HasMany
    {
        return $this->hasMany(Shipment::class);
    }
}
