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
        if (! empty($data['idempotency_key'])) {
            $existing = $order->shipments()->where('idempotency_key', $data['idempotency_key'])->first();
            if ($existing) return $existing->load(['items.orderItem', 'tracking', 'method', 'carrierRecord', 'rider']);
        }
        $isCod = $order->payments()->where('provider', 'cod')->exists();
        if (! $isCod && $order->payment_status !== 'paid') {
            throw ValidationException::withMessages(['order' => 'A shipment requires verified payment.']);
        }
        if (in_array($order->fulfillment_status, ['cancelled', 'delivered'], true)) {
            throw ValidationException::withMessages(['order' => 'This order cannot be shipped.']);
        }

        return DB::transaction(function () use ($order, $data) {
            $deliveryMethod = $data['delivery_method'] ?? 'external_courier';
            $shipment = $order->shipments()->create([
                'shipping_method_id' => $data['shipping_method_id'] ?? $order->shipping_method_id,
                'delivery_method' => $deliveryMethod,
                'carrier_id' => $data['carrier_id'] ?? null,
                'status' => 'pending',
                'carrier' => $deliveryMethod === 'self_delivery' ? ($data['carrier'] ?? 'Kipi Self Delivery') : ($data['carrier'] ?? null),
                'tracking_number' => $deliveryMethod === 'external_courier' ? ($data['tracking_number'] ?? null) : null,
                'internal_tracking_id' => $deliveryMethod === 'self_delivery' ? Shipment::nextInternalTrackingId() : null,
                'rider_id' => $data['rider_id'] ?? null,
                'estimated_delivery_at' => $data['estimated_delivery_at'] ?? null,
                'notes' => $data['notes'] ?? null,
                'created_by' => $data['actor_id'] ?? null,
                'idempotency_key' => $data['idempotency_key'] ?? null,
                'metadata' => array_filter(['tracking_url' => $data['tracking_url'] ?? null]),
            ]);
            foreach ($order->items as $item) {
                $shipment->items()->create(['order_item_id' => $item->id, 'quantity' => $item->quantity]);
            }
            $shipment->tracking()->create(['status' => 'pending', 'actor_id' => $data['actor_id'] ?? null, 'actor_role' => $data['actor_role'] ?? null, 'source' => 'manual', 'occurred_at' => now()]);

            return $shipment->load(['items.orderItem', 'tracking', 'method']);
        });
    }

    public function transition(Shipment $shipment, string $next, ?string $message = null, ?string $location = null, ?int $changedBy = null, ?string $actorRole = null): Shipment
    {
        $allowed = [
            'pending' => ['preparing', 'picked_up', 'failed_delivery'],
            'preparing' => ['picked_up', 'shipped', 'failed_delivery'],
            'picked_up' => ['shipped', 'in_transit', 'failed_delivery'],
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

        return DB::transaction(function () use ($shipment, $next, $message, $location, $changedBy, $actorRole) {
            $from = $shipment->status;
            $shipment->update([
                'status' => $next,
                'shipped_at' => in_array($next, ['picked_up', 'shipped', 'in_transit', 'out_for_delivery'], true) ? ($shipment->shipped_at ?? now()) : $shipment->shipped_at,
                'delivered_at' => $next === 'delivered' ? now() : $shipment->delivered_at,
            ]);
            $shipment->tracking()->create(['status' => $next, 'previous_status' => $from, 'message' => $message, 'location' => $location, 'actor_id' => $changedBy, 'actor_role' => $actorRole, 'source' => 'manual', 'occurred_at' => now()]);
            $shipment->order->statusHistory()->create(['status_type' => 'shipment', 'from_status' => $from, 'to_status' => $next, 'changed_by' => $changedBy, 'note' => $message]);
            if ($next === 'picked_up' || $next === 'shipped' || $next === 'in_transit' || $next === 'out_for_delivery') {
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
