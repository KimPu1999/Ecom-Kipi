<?php

namespace Tests\Feature\Api;

use App\Models\Order;
use App\Models\Rider;
use App\Models\Role;
use App\Models\Shipment;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Laravel\Sanctum\Sanctum;
use Tests\TestCase;

class ShippingManagementTest extends TestCase
{
    use RefreshDatabase;

    public function test_self_delivery_ids_are_readable_and_unique(): void
    {
        $first = Shipment::nextInternalTrackingId();
        $second = Shipment::nextInternalTrackingId();

        $this->assertMatchesRegularExpression('/^KIPI-DEL-\d{4}-\d{6}$/', $first);
        $this->assertNotSame($first, $second);
    }

    public function test_super_admin_can_configure_a_carrier_without_deleting_shipments(): void
    {
        $admin = User::factory()->create();
        $admin->roles()->attach(Role::query()->create(['name' => 'super_admin', 'label' => 'Super Administrator']));
        Sanctum::actingAs($admin);

        $this->postJson('/api/v1/admin/shipping/carriers', [
            'name' => 'Test Courier',
            'code' => 'test-courier',
            'type' => 'external_courier',
            'tracking_url' => 'https://carrier.example/track',
        ])->assertCreated()->assertJsonPath('data.code', 'test-courier');

        $this->getJson('/api/v1/admin/shipping/carriers')->assertOk()->assertJsonPath('data.0.name', 'Test Courier');
    }

    public function test_only_the_assigned_rider_can_update_a_shipment(): void
    {
        $assignedUser = User::factory()->create();
        $otherUser = User::factory()->create();
        $rider = Rider::query()->create(['user_id' => $assignedUser->id, 'name' => 'Assigned rider', 'status' => 'active']);
        $order = Order::query()->create(['user_id' => $assignedUser->id, 'order_number' => 'ORD-RIDER-'.uniqid(), 'shipping_address' => ['line1' => 'Main'], 'subtotal_minor' => 1000, 'grand_total_minor' => 1000, 'currency' => 'MMK']);
        $shipment = $order->shipments()->create(['delivery_method' => 'self_delivery', 'internal_tracking_id' => Shipment::nextInternalTrackingId(), 'rider_id' => $rider->id, 'status' => 'pending']);

        Sanctum::actingAs($otherUser);
        $this->patchJson('/api/v1/rider/shipments/'.$shipment->id.'/status', ['status' => 'picked_up'])->assertNotFound();

        Sanctum::actingAs($assignedUser);
        $this->patchJson('/api/v1/rider/shipments/'.$shipment->id.'/status', ['status' => 'picked_up'])->assertOk();
        $this->assertDatabaseHas('shipment_tracking', ['shipment_id' => $shipment->id, 'previous_status' => 'pending', 'actor_id' => $assignedUser->id, 'actor_role' => 'rider']);
    }
}
