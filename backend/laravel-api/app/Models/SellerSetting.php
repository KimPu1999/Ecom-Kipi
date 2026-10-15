<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Relations\BelongsTo;

class SellerSetting extends Model
{
    protected $fillable = ['seller_id', 'store_policies', 'shipping_configuration', 'notification_preferences', 'operational_settings'];

    protected function casts(): array
    {
        return ['store_policies' => 'array', 'shipping_configuration' => 'array', 'notification_preferences' => 'array', 'operational_settings' => 'array'];
    }

    public function seller(): BelongsTo
    {
        return $this->belongsTo(Seller::class);
    }
}
