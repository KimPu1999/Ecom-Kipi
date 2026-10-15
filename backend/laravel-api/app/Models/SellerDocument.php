<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Relations\BelongsTo;

class SellerDocument extends Model
{
    protected $fillable = ['seller_application_id', 'document_type', 'storage_path', 'status', 'retention_until', 'verified_by'];

    protected $hidden = ['storage_path'];

    protected function casts(): array
    {
        return ['retention_until' => 'datetime'];
    }

    public function application(): BelongsTo
    {
        return $this->belongsTo(SellerApplication::class, 'seller_application_id');
    }

    public function verifier(): BelongsTo
    {
        return $this->belongsTo(User::class, 'verified_by');
    }
}
