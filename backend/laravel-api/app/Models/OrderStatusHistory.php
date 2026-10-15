<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Relations\BelongsTo;

class OrderStatusHistory extends Model
{
    protected $table = 'order_status_history';

    protected $fillable = [
        'order_id', 'status_type', 'from_status', 'to_status', 'changed_by', 'note',
    ];

    public function order(): BelongsTo
    {
        return $this->belongsTo(Order::class);
    }
}
