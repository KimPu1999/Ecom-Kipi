<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;

class Shipment extends Model
{
    protected $fillable = ['order_id', 'seller_order_id', 'shipping_method_id', 'delivery_method', 'carrier_id', 'status', 'carrier', 'tracking_number', 'internal_tracking_id', 'rider_id', 'estimated_delivery_at', 'shipped_at', 'delivered_at', 'notes', 'created_by', 'idempotency_key', 'metadata'];

    protected function casts(): array
    {
        return ['estimated_delivery_at' => 'datetime', 'shipped_at' => 'datetime', 'delivered_at' => 'datetime', 'metadata' => 'array'];
    }

    public static function nextInternalTrackingId(): string
    {
        do {
            $id = 'KIPI-DEL-'.now()->format('Y').'-'.str_pad((string) random_int(0, 999999), 6, '0', STR_PAD_LEFT);
        } while (static::query()->where('internal_tracking_id', $id)->exists());

        return $id;
    }

    public function order(): BelongsTo
    {
        return $this->belongsTo(Order::class);
    }

    public function sellerOrder(): BelongsTo
    {
        return $this->belongsTo(SellerOrder::class);
    }

    public function method(): BelongsTo
    {
        return $this->belongsTo(ShippingMethod::class, 'shipping_method_id');
    }

    public function carrierRecord(): BelongsTo
    {
        return $this->belongsTo(ShippingCarrier::class, 'carrier_id');
    }

    public function rider(): BelongsTo
    {
        return $this->belongsTo(Rider::class);
    }

    public function creator(): BelongsTo
    {
        return $this->belongsTo(User::class, 'created_by');
    }

    public function items(): HasMany
    {
        return $this->hasMany(ShipmentItem::class);
    }

    public function tracking(): HasMany
    {
        return $this->hasMany(ShipmentTracking::class);
    }
}
