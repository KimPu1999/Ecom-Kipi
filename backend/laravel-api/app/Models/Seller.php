<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Builder;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;
use Illuminate\Database\Eloquent\Relations\HasOne;

class Seller extends Model
{
    public const STATUS_PENDING = 'pending';

    public const STATUS_APPROVED = 'approved';

    public const STATUS_REJECTED = 'rejected';

    public const STATUS_SUSPENDED = 'suspended';

    protected $fillable = ['owner_user_id', 'store_name', 'slug', 'description', 'logo_path', 'banner_path', 'support_email', 'support_phone', 'status', 'payout_provider', 'payout_provider_account_id', 'approved_at', 'approved_by', 'suspended_at'];

    protected function casts(): array
    {
        return ['approved_at' => 'datetime', 'suspended_at' => 'datetime'];
    }

    public function scopeApproved(Builder $query): Builder
    {
        return $query->whereIn('status', [self::STATUS_APPROVED, 'active']);
    }

    public function isApproved(): bool
    {
        return in_array($this->status, [self::STATUS_APPROVED, 'active'], true);
    }

    public function owner(): BelongsTo
    {
        return $this->belongsTo(User::class, 'owner_user_id');
    }

    public function approver(): BelongsTo
    {
        return $this->belongsTo(User::class, 'approved_by');
    }

    public function memberships(): HasMany
    {
        return $this->hasMany(SellerMembership::class);
    }

    public function products(): HasMany
    {
        return $this->hasMany(Product::class);
    }

    public function orders(): HasMany
    {
        return $this->hasMany(SellerOrder::class);
    }

    public function settings(): HasOne
    {
        return $this->hasOne(SellerSetting::class);
    }

    public function ledgerEntries(): HasMany
    {
        return $this->hasMany(SellerLedgerEntry::class);
    }

    public function payouts(): HasMany
    {
        return $this->hasMany(SellerPayout::class);
    }

    public function payoutMethods(): HasMany
    {
        return $this->hasMany(SellerPayoutMethod::class);
    }

    public function approvalHistory(): HasMany
    {
        return $this->hasMany(SellerApprovalHistory::class);
    }
}
