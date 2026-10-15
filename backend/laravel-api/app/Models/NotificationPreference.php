<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Relations\BelongsTo;

class NotificationPreference extends Model
{
    protected $fillable = ['user_id', 'order_updates', 'payment_updates', 'delivery_updates'];

    protected function casts(): array
    {
        return ['order_updates' => 'boolean', 'payment_updates' => 'boolean', 'delivery_updates' => 'boolean'];
    }

    public function user(): BelongsTo
    {
        return $this->belongsTo(User::class);
    }
}
