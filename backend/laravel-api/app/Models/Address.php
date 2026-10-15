<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Relations\BelongsTo;

class Address extends Model
{
    protected $fillable = [
        'label', 'recipient_name', 'phone', 'line1', 'line2',
        'city', 'state', 'postal_code', 'country', 'is_default',
    ];

    protected function casts(): array
    {
        return ['is_default' => 'boolean'];
    }

    public function user(): BelongsTo
    {
        return $this->belongsTo(User::class);
    }
}
