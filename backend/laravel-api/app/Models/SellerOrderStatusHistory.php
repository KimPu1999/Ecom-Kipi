<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Relations\BelongsTo;

class SellerOrderStatusHistory extends Model
{
    protected $table = 'seller_order_status_history';

    protected $fillable = ['seller_order_id', 'from_status', 'to_status', 'changed_by', 'note'];

    public function sellerOrder(): BelongsTo
    {
        return $this->belongsTo(SellerOrder::class);
    }

    public function actor(): BelongsTo
    {
        return $this->belongsTo(User::class, 'changed_by');
    }
}
