<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Relations\BelongsTo;

class AuditLog extends Model
{
    protected $fillable = [
        'actor_user_id',
        'action',
        'resource_type',
        'resource_id',
        'ip_address',
        'request_id',
        'before',
        'after',
    ];

    protected function casts(): array
    {
        return ['before' => 'array', 'after' => 'array'];
    }

    public function actor(): BelongsTo
    {
        return $this->belongsTo(User::class, 'actor_user_id');
    }
}
