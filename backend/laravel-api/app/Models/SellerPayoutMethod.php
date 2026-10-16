<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;

class SellerPayoutMethod extends Model
{
    protected $fillable = [
        'seller_id', 'method', 'provider_name', 'account_holder_name',
        'account_identifier', 'account_last4', 'verification_status',
        'verified_at', 'verified_by', 'is_default', 'is_active',
    ];

    protected $hidden = ['account_identifier'];

    protected function casts(): array
    {
        return [
            'account_identifier' => 'encrypted',
            'verified_at' => 'datetime',
            'is_default' => 'boolean',
            'is_active' => 'boolean',
        ];
    }

    public function seller(): BelongsTo
    {
        return $this->belongsTo(Seller::class);
    }

    public function verifiedBy(): BelongsTo
    {
        return $this->belongsTo(User::class, 'verified_by');
    }

    public function payouts(): HasMany
    {
        return $this->hasMany(SellerPayout::class, 'payout_method_id');
    }

    public function maskedIdentifier(): string
    {
        $identifier = (string) $this->account_identifier;

        return $identifier === '' ? 'Not provided' : '••••'.substr($identifier, -4);
    }

    public function safeArray(): array
    {
        return [
            'id' => $this->id,
            'method' => $this->method,
            'provider_name' => $this->provider_name,
            'account_holder_name' => $this->account_holder_name,
            'account_last4' => $this->account_last4,
            'masked_identifier' => $this->maskedIdentifier(),
            'verification_status' => $this->verification_status,
            'verified_at' => $this->verified_at?->toISOString(),
            'is_default' => (bool) $this->is_default,
            'is_active' => (bool) $this->is_active,
            'created_at' => $this->created_at?->toISOString(),
            'updated_at' => $this->updated_at?->toISOString(),
        ];
    }
}
