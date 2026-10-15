<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Relations\BelongsTo;

class ShipmentTracking extends Model
{
    protected $table = 'shipment_tracking';

    protected $fillable = ['shipment_id', 'status', 'previous_status', 'location', 'message', 'actor_id', 'actor_role', 'source', 'proof_reference', 'occurred_at'];

    protected function casts(): array
    {
        return ['occurred_at' => 'datetime'];
    }

    public function shipment(): BelongsTo
    {
        return $this->belongsTo(Shipment::class);
    }

    public function actor(): BelongsTo
    {
        return $this->belongsTo(User::class, 'actor_id');
    }
}
