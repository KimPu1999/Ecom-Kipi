<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Relations\BelongsTo;

class InventoryMovement extends Model
{
    protected $fillable = [
        'inventory_id', 'quantity_delta', 'quantity_after', 'type',
        'reference_type', 'reference_id', 'created_by', 'note',
    ];

    public function inventory(): BelongsTo
    {
        return $this->belongsTo(Inventory::class);
    }
}
