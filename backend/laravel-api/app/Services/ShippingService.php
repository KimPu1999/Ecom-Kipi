<?php

namespace App\Services;

use App\Jobs\SendOrderPushNotification;
use App\Models\Order;
use App\Models\Shipment;
use Illuminate\Support\Facades\DB;
use Illuminate\Validation\ValidationException;

class ShippingService
{
    public function create(Order $order, array $data): Shipment
    {
        if ($order->payment_status !== 'paid') {
            throw ValidationException::withMessages(['order' => 'A shipment requires verified payment.']);
        }
        if (in_array($order->fulfillment_status, ['cancelled', 'delivered'], true)) {
            throw ValidationException::withMessages(['order' => 'This order cannot be shipped.']);
        }

        return DB::transaction(function () use ($order, $data) {
            $shipment = $order->shipments()->create([
                'shipping_method_id' => $data['shipping_method_id'] ?? $order->shipping_method_id,
                'status' => 'pending',
                'carrier' => $data['carrier'] ?? null,
                'tracking_number' => $data['tracking_number'] ?? null,
            ]);
            foreach ($order->items as $item) {
                $shipment->items()->create(['order_item_id' => $item->id, 'quantity' => $item->quantity]);
            }
            $shipment->tracking()->create(['status' => 'pending', 'occurred_at' => now()]);

            return $shipment->load(['items.orderItem', 'tracking', 'method']);
        });
    }

    public function transition(Shipment $shipment, string $next, ?string $message = null, ?string $location = null, ?int $changedBy = null): Shipment
    {
        $allowed = [
            'pending' => ['preparing', 'failed_delivery'],
            'preparing' => ['shipped', 'failed_delivery'],
            'shipped' => ['in_transit', 'delivered', 'failed_delivery'],
            'in_transit' => ['out_for_delivery', 'delivered', 'failed_delivery'],
            'out_for_delivery' => ['delivered', 'failed_delivery'],
            'delivered' => [],
            'failed_delivery' => ['preparing', 'returned'],
            'returned' => [],
        ];
        if (! in_array($next, $allowed[$shipment->status] ?? [], true)) {
            throw ValidationException::withMessages(['status' => 'Invalid shipment status transition.']);
        }

        return DB::transaction(function () use ($shipment, $next, $message, $location, $changedBy) {
            $from = $shipment->status;
            $shipment->update([
                'status' => $next,
                'shipped_at' => in_array($next, ['shipped', 'in_transit', 'out_for_delivery'], true) ? ($shipment->shipped_at ?? now()) : $shipment->shipped_at,
                'delivered_at' => $next === 'delivered' ? now() : $shipment->delivered_at,
            ]);
            $shipment->tracking()->create(['status' => $next, 'message' => $message, 'location' => $location, 'occurred_at' => now()]);
            $shipment->order->statusHistory()->create(['status_type' => 'shipment', 'from_status' => $from, 'to_status' => $next, 'changed_by' => $changedBy, 'note' => $message]);
            if ($next === 'shipped' || $next === 'in_transit' || $next === 'out_for_delivery') {
                $shipment->order()->update(['fulfillment_status' => 'shipped']);
            } elseif ($next === 'delivered') {
                $shipment->order()->update(['fulfillment_status' => 'delivered']);
            }

            if (! app()->environment('testing')) {
                $event = $next === 'out_for_delivery' ? 'out_for_delivery' : ($next === 'delivered' ? 'delivered' : 'shipped');
                $message = $event === 'delivered' ? 'Your order was delivered.' : ($event === 'out_for_delivery' ? 'Your order is out for delivery.' : 'Your order has shipped.');
                DB::afterCommit(fn () => SendOrderPushNotification::dispatch($shipment->order->fresh(), $event, $message));
            }

            return $shipment->fresh(['items.orderItem', 'tracking', 'method']);
        });
    }
}
