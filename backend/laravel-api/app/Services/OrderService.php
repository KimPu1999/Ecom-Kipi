<?php

namespace App\Services;

use App\Models\Order;
use App\Models\User;
use Illuminate\Support\Facades\DB;
use Illuminate\Validation\ValidationException;

class OrderService
{
    public function __construct(
        private readonly CheckoutService $checkout,
        private readonly InventoryReservationService $reservations,
    ) {}

    public function create(int $userId, array $data): Order
    {
        return $this->checkout->confirm(User::query()->findOrFail($userId), $data);
    }

    public function cancel(Order $order, ?int $userId = null): Order
    {
        return DB::transaction(function () use ($order, $userId) {
            if ($order->fulfillment_status !== 'pending' || $order->cancelled_at) {
                throw ValidationException::withMessages(['order' => 'This order cannot be cancelled.']);
            }

            $this->reservations->releaseOrder($order, $userId);

            $order->update(['fulfillment_status' => 'cancelled', 'cancelled_at' => now()]);
            $order->statusHistory()->create([
                'status_type' => 'fulfillment',
                'from_status' => 'pending',
                'to_status' => 'cancelled',
                'changed_by' => $userId,
                'note' => 'Order cancelled.',
            ]);

            return $order->fresh(['items', 'statusHistory']);
        });
    }
}
