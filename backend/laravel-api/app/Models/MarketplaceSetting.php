<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Relations\BelongsTo;

class MarketplaceSetting extends Model
{
    protected $fillable = ['name', 'value', 'updated_by'];

    protected function casts(): array
    {
        return ['value' => 'array'];
    }

    public function updatedBy(): BelongsTo
    {
        return $this->belongsTo(User::class, 'updated_by');
    }
}
