<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;

class SellerOrder extends Model
{
    protected $fillable = ['order_id', 'seller_id', 'order_number', 'status', 'payment_status', 'fulfillment_status', 'subtotal_minor', 'shipping_minor', 'commission_minor', 'net_minor', 'currency'];

    public function order(): BelongsTo
    {
        return $this->belongsTo(Order::class);
    }

    public function seller(): BelongsTo
    {
        return $this->belongsTo(Seller::class);
    }

    public function items(): HasMany
    {
        return $this->hasMany(SellerOrderItem::class);
    }

    public function statusHistory(): HasMany
    {
        return $this->hasMany(SellerOrderStatusHistory::class);
    }

    public function commissions(): HasMany
    {
        return $this->hasMany(OrderCommission::class);
    }

    public function shipments(): HasMany
    {
        return $this->hasMany(Shipment::class);
    }
}
