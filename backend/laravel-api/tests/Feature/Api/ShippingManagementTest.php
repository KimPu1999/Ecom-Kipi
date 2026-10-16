<?php

namespace Tests\Feature\Api;

use App\Models\Order;
use App\Models\OrderItem;
use App\Models\Rider;
use App\Models\Role;
use App\Models\Seller;
use App\Models\SellerOrder;
use App\Models\Shipment;
use App\Models\SellerOrderItem;
use App\Models\ShippingMethod;
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

    public function test_super_admin_can_create_separate_delivery_methods_and_update_one_without_replacing_the_other(): void
    {
        $admin = User::factory()->create();
        $admin->roles()->attach(Role::query()->create(['name' => 'super_admin', 'label' => 'Super Administrator']));
        Sanctum::actingAs($admin);

        $first = $this->postJson('/api/v1/admin/shipping/methods', [
            'name' => 'Express delivery',
            'code' => 'express',
            'description' => 'One business day',
            'price_minor' => 1500,
            'currency' => 'MMK',
            'sort_order' => 1,
        ])->assertCreated();
        $firstId = $first->json('data.id');

        $second = $this->postJson('/api/v1/admin/shipping/methods', [
            'name' => 'Pickup point',
            'code' => 'pickup',
            'description' => 'Collect from a Kipi point',
            'price_minor' => 0,
            'currency' => 'MMK',
            'sort_order' => 2,
        ])->assertCreated();
        $secondId = $second->json('data.id');

        $this->getJson('/api/v1/admin/shipping/methods')
            ->assertOk()
            ->assertJsonFragment(['id' => $firstId, 'name' => 'Express delivery'])
            ->assertJsonFragment(['id' => $secondId, 'name' => 'Pickup point']);

        $this->patchJson('/api/v1/admin/shipping/methods/'.$firstId, ['is_active' => false])
            ->assertOk()
            ->assertJsonPath('data.is_active', false);

        $this->assertDatabaseHas('shipping_methods', ['id' => $firstId, 'is_active' => false]);
        $this->assertDatabaseHas('shipping_methods', ['id' => $secondId, 'is_active' => true]);
        $this->assertSame(1, ShippingMethod::query()->where('code', 'pickup')->count());
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

    public function test_seller_shipment_creation_is_idempotent_and_details_are_owner_scoped(): void
    {
        $sellerUser = User::factory()->create();
        $otherSellerUser = User::factory()->create();
        $customer = User::factory()->create();
        $seller = Seller::query()->create(['owner_user_id' => $sellerUser->id, 'store_name' => 'Seller One', 'slug' => 'seller-one-'.uniqid(), 'status' => 'approved']);
        $otherSeller = Seller::query()->create(['owner_user_id' => $otherSellerUser->id, 'store_name' => 'Seller Two', 'slug' => 'seller-two-'.uniqid(), 'status' => 'approved']);
        $order = Order::query()->create(['user_id' => $customer->id, 'order_number' => 'ORD-SELLER-SHIP-'.uniqid(), 'shipping_address' => ['line1' => 'Main'], 'subtotal_minor' => 1000, 'grand_total_minor' => 1000, 'currency' => 'MMK', 'payment_status' => 'paid', 'fulfillment_status' => 'confirmed']);
        $orderItem = OrderItem::query()->create(['order_id' => $order->id, 'product_name' => 'Shipment product', 'sku' => 'SHIP-'.uniqid(), 'quantity' => 1, 'unit_price_minor' => 1000, 'line_total_minor' => 1000, 'seller_id' => $seller->id]);
        $sellerOrder = SellerOrder::query()->create(['order_id' => $order->id, 'seller_id' => $seller->id, 'order_number' => 'SELLER-'.uniqid(), 'status' => 'confirmed', 'payment_status' => 'paid', 'fulfillment_status' => 'confirmed', 'subtotal_minor' => 1000, 'commission_minor' => 50, 'net_minor' => 950, 'currency' => 'MMK']);
        SellerOrderItem::query()->create(['seller_order_id' => $sellerOrder->id, 'order_item_id' => $orderItem->id, 'product_name' => 'Shipment product', 'sku' => $orderItem->sku, 'quantity' => 1, 'unit_price_minor' => 1000, 'line_total_minor' => 1000]);

        Sanctum::actingAs($sellerUser);
        $payload = ['delivery_method' => 'self_delivery', 'carrier' => 'Kipi Self Delivery'];
        $first = $this->withHeader('Idempotency-Key', 'seller-shipment-test-key')->postJson('/api/v1/seller/orders/'.$sellerOrder->id.'/shipments', $payload)->assertCreated();
        $shipmentId = $first->json('data.id');
        $this->withHeader('Idempotency-Key', 'seller-shipment-test-key')->postJson('/api/v1/seller/orders/'.$sellerOrder->id.'/shipments', $payload)->assertCreated()->assertJsonPath('data.id', $shipmentId);
        $this->assertDatabaseCount('shipments', 1);
        $this->getJson('/api/v1/seller/shipments/'.$shipmentId)->assertOk()->assertJsonPath('data.id', $shipmentId)->assertJsonPath('data.delivery_method', 'self_delivery');

        Sanctum::actingAs($customer);
        $this->getJson('/api/v1/orders/'.$order->id.'/shipments')->assertOk()->assertJsonPath('data.0.id', $shipmentId);
        Sanctum::actingAs(User::factory()->create());
        $this->getJson('/api/v1/orders/'.$order->id.'/shipments')->assertNotFound();

        Sanctum::actingAs($otherSellerUser);
        $this->getJson('/api/v1/seller/shipments/'.$shipmentId)->assertNotFound();
        $this->assertDatabaseHas('sellers', ['id' => $otherSeller->id]);
    }
}
