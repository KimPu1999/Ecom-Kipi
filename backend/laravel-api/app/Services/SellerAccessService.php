<?php

namespace App\Services;

use App\Models\Seller;
use App\Models\User;

class SellerAccessService
{
    public function sellerFor(User $user): Seller
    {
        $seller = Seller::query()
            ->whereIn('status', [Seller::STATUS_APPROVED, 'active'])
            ->where(function ($query) use ($user) {
                $query->where('owner_user_id', $user->id)
                    ->orWhereHas('memberships', fn ($membership) => $membership->where('user_id', $user->id)->where('status', 'active'));
            })
            ->first();

        abort_unless($seller, 403, 'Approved seller access required.');

        return $seller;
    }
}
