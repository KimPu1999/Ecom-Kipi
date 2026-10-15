<?php

namespace Database\Factories;

use App\Models\SellerApprovalHistory;
use Illuminate\Database\Eloquent\Factories\Factory;

/**
 * @extends Factory<SellerApprovalHistory>
 */
class SellerApprovalHistoryFactory extends Factory
{
    /**
     * Define the model's default state.
     *
     * @return array<string, mixed>
     */
    public function definition(): array
    {
        return [
            'from_status' => null,
            'to_status' => 'pending',
            'action' => 'submitted',
            'reason' => null,
            'metadata' => [],
        ];
    }
}
