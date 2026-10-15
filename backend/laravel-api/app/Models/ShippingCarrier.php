<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Relations\HasMany;

class ShippingCarrier extends Model
{
    protected $fillable = ['name', 'code', 'type', 'tracking_url', 'tracking_url_template', 'contact_email', 'contact_phone', 'regions', 'is_active', 'sort_order'];

    protected function casts(): array
    {
        return ['regions' => 'array', 'is_active' => 'boolean'];
    }

    public function shipments(): HasMany
    {
        return $this->hasMany(Shipment::class, 'carrier_id');
    }
}
