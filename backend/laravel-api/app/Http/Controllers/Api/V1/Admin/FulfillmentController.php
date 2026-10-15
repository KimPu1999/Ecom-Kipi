<?php

namespace App\Http\Controllers\Api\V1\Admin;

use App\Http\Controllers\Controller;
use App\Http\Requests\Api\V1\AdminShipmentRequest;
use App\Http\Requests\Api\V1\ShipmentStatusRequest;
use App\Models\AuditLog;
use App\Models\Order;
use App\Models\Shipment;
use App\Services\ShippingService;
use App\Support\ApiResponse;

class FulfillmentController extends Controller
{
    public function createShipment(AdminShipmentRequest $request, Order $order, ShippingService $shipping)
    {
        $data = $request->validated() + ['actor_id' => $request->user()->id, 'actor_role' => 'admin'];
        $data['delivery_method'] = $data['delivery_method'] ?? (empty($data['tracking_number']) ? 'self_delivery' : 'external_courier');
        $data['idempotency_key'] = substr($request->header('Idempotency-Key', ''), 0, 120) ?: null;
        $shipment = $shipping->create($order->load('items'), $data);
        AuditLog::query()->create(['actor_id' => $request->user()->id, 'action' => 'shipment.created', 'resource_type' => Shipment::class, 'resource_id' => $shipment->id, 'after' => $shipment->toArray(), 'ip_address' => $request->ip(), 'user_agent' => $request->userAgent()]);

        return ApiResponse::success($shipment, 'Shipment created', 201);
    }

    public function updateShipment(ShipmentStatusRequest $request, Shipment $shipment, ShippingService $shipping)
    {
        $before = $shipment->toArray();
        $updated = $shipping->transition($shipment, $request->string('status')->toString(), $request->input('message'), $request->input('location'), $request->user()->id, 'admin');
        AuditLog::query()->create(['actor_id' => $request->user()->id, 'action' => 'shipment.status_updated', 'resource_type' => Shipment::class, 'resource_id' => $shipment->id, 'before' => $before, 'after' => $updated->toArray(), 'ip_address' => $request->ip(), 'user_agent' => $request->userAgent()]);

        return ApiResponse::success($updated, 'Shipment updated');
    }
}
