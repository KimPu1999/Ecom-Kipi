<?php

namespace App\Http\Controllers\Api\V1;

use App\Http\Controllers\Controller;
use App\Models\Rider;
use App\Models\Shipment;
use App\Services\ShippingService;
use App\Support\ApiResponse;
use Illuminate\Http\Request;

class RiderController extends Controller
{
    public function shipments(Request $request)
    {
        $rider = $this->rider($request);
        $shipments = Shipment::query()->where('rider_id', $rider->id)->with(['order', 'items.orderItem', 'tracking', 'carrierRecord'])->latest()->paginate(min($request->integer('per_page', 20), 50));

        return ApiResponse::paginated($shipments, $shipments->items(), 'Assigned shipments retrieved');
    }

    public function updateShipment(Request $request, Shipment $shipment, ShippingService $shipping)
    {
        $rider = $this->rider($request);
        abort_unless((int) $shipment->rider_id === (int) $rider->id && $rider->status === 'active', 404);
        $data = $request->validate(['status' => ['required', 'in:picked_up,in_transit,out_for_delivery,delivered,failed_delivery'], 'message' => ['nullable', 'string', 'max:2000'], 'location' => ['nullable', 'string', 'max:160']]);

        return ApiResponse::success($shipping->transition($shipment, $data['status'], $data['message'] ?? null, $data['location'] ?? null, $request->user()->id, 'rider'), 'Rider shipment updated');
    }

    private function rider(Request $request): Rider
    {
        return Rider::query()->where('user_id', $request->user()->id)->firstOrFail();
    }
}
