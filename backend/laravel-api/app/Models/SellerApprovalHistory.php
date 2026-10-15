<?php

namespace App\Models;

use Database\Factories\SellerApprovalHistoryFactory;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class SellerApprovalHistory extends Model
{
    /** @use HasFactory<SellerApprovalHistoryFactory> */
    use HasFactory;

    protected $table = 'seller_approval_history';

    protected $fillable = ['seller_application_id', 'seller_id', 'from_status', 'to_status', 'action', 'reason', 'changed_by', 'metadata'];

    protected function casts(): array
    {
        return ['metadata' => 'array'];
    }

    public function application(): BelongsTo
    {
        return $this->belongsTo(SellerApplication::class, 'seller_application_id');
    }

    public function seller(): BelongsTo
    {
        return $this->belongsTo(Seller::class);
    }

    public function changedBy(): BelongsTo
    {
        return $this->belongsTo(User::class, 'changed_by');
    }
}
