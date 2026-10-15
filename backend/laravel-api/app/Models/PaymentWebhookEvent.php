<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model as EloquentModel;

class PaymentWebhookEvent extends EloquentModel
{
    protected $fillable = ['provider', 'provider_event_id', 'status', 'payload', 'error', 'processed_at'];

    protected function casts(): array
    {
        return ['payload' => 'array', 'processed_at' => 'datetime'];
    }
}
