<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;

class SellerApplication extends Model
{
    public const STATUS_PENDING = 'pending';

    public const STATUS_APPROVED = 'approved';

    public const STATUS_REJECTED = 'rejected';

    public const STATUS_SUSPENDED = 'suspended';

    protected $fillable = ['user_id', 'business_name', 'business_type', 'business_details', 'contact_details', 'application_status', 'submitted_at', 'reviewed_at', 'reviewed_by', 'rejection_reason'];

    protected function casts(): array
    {
        return ['business_details' => 'array', 'contact_details' => 'array', 'submitted_at' => 'datetime', 'reviewed_at' => 'datetime'];
    }

    public function isPending(): bool
    {
        return in_array($this->application_status, [self::STATUS_PENDING, 'submitted', 'under_review'], true);
    }

    public function user(): BelongsTo
    {
        return $this->belongsTo(User::class);
    }

    public function reviewer(): BelongsTo
    {
        return $this->belongsTo(User::class, 'reviewed_by');
    }

    public function documents(): HasMany
    {
        return $this->hasMany(SellerDocument::class);
    }

    public function approvalHistory(): HasMany
    {
        return $this->hasMany(SellerApprovalHistory::class);
    }
}
