<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Relations\BelongsTo;

class IdempotencyKey extends Model
{
    protected $fillable = ['user_id', 'operation', 'key', 'request_hash', 'response_code', 'response_payload', 'status', 'expires_at'];

    protected function casts(): array
    {
        return ['response_payload' => 'array', 'expires_at' => 'datetime'];
    }

    public function user(): BelongsTo
    {
        return $this->belongsTo(User::class);
    }
}
