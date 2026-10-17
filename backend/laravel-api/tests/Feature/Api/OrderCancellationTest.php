<?php

namespace Tests\Feature\Api;

use App\Models\Category;
use App\Models\Inventory;
use App\Models\Order;
use App\Models\Product;
use App\Models\ShippingMethod;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Laravel\Sanctum\Sanctum;
use Tests\TestCase;

class OrderCancellationTest extends TestCase
{
    use RefreshDatabase;

    public function test_checkout_confirmation_locks_customer_cancellation_and_is_idempotent(): void
    {
        [$customer, $order] = $this->checkoutOrder('customer-confirmation-lock');

        Sanctum::actingAs($customer);
        $this->postJson('/api/v1/checkout/confirm', $this->checkoutPayload('customer-confirmation-lock'))
            ->assertCreated()
            ->assertJsonPath('data.id', $order->id);
        $this->getJson('/api/v1/orders/'.$order->id)
            ->assertOk()
            ->assertJsonPath('data.customer_confirmed', true);

        $this->postJson('/api/v1/orders/'.$order->id.'/cancel')
            ->assertUnprocessable()
            ->assertJsonValidationErrors(['order'])
            ->assertJsonPath('errors.order.0', 'A confirmed order cannot be cancelled by the customer.');

        $this->assertDatabaseHas('orders', [
            'id' => $order->id,
            'fulfillment_status' => 'pending',
            'cancelled_at' => null,
        ]);
        $this->assertDatabaseCount('orders', 1);
    }

    public function test_another_customer_cannot_cancel_a_confirmed_order(): void
    {
        [$customer, $order] = $this->checkoutOrder('ownership-lock');
        $otherCustomer = User::factory()->create();

        Sanctum::actingAs($otherCustomer);
        $this->postJson('/api/v1/orders/'.$order->id.'/cancel')->assertNotFound();

        $this->assertDatabaseHas('orders', [
            'id' => $order->id,
            'user_id' => $customer->id,
            'fulfillment_status' => 'pending',
        ]);
    }

    public function test_unconfirmed_legacy_pending_order_can_still_be_cancelled(): void
    {
        $customer = User::factory()->create();
        $order = Order::query()->create([
            'user_id' => $customer->id,
            'order_number' => 'ORD-LEGACY-'.uniqid(),
            'shipping_address' => ['line1' => 'Main Street'],
            'subtotal_minor' => 1000,
            'discount_minor' => 0,
            'shipping_minor' => 0,
            'tax_minor' => 0,
            'grand_total_minor' => 1000,
            'currency' => 'MMK',
            'payment_status' => 'pending',
            'fulfillment_status' => 'pending',
            'placed_at' => null,
        ]);

        Sanctum::actingAs($customer);
        $this->postJson('/api/v1/orders/'.$order->id.'/cancel')
            ->assertOk()
            ->assertJsonPath('data.fulfillment_status', 'cancelled');

        $this->assertDatabaseHas('orders', [
            'id' => $order->id,
            'fulfillment_status' => 'cancelled',
        ]);

        $this->getJson('/api/v1/orders?fulfillment_status=pending')
            ->assertOk()
            ->assertJsonPath('meta.total', 0);
        $this->getJson('/api/v1/orders?fulfillment_status=cancelled')
            ->assertOk()
            ->assertJsonPath('meta.total', 1)
            ->assertJsonPath('data.0.id', $order->id)
            ->assertJsonPath('data.0.fulfillment_status', 'cancelled');
    }

    private function checkoutOrder(string $idempotencyKey): array
    {
        $customer = User::factory()->create();
        $category = Category::query()->create(['name' => 'Cancellation tests', 'slug' => 'cancellation-'.uniqid()]);
        $product = Product::query()->create([
            'category_id' => $category->id,
            'name' => 'Cancellation product',
            'slug' => 'cancellation-product-'.uniqid(),
            'status' => 'published',
        ]);
        $variant = $product->variants()->create([
            'sku' => 'CANCEL-'.uniqid(),
            'price_minor' => 1000,
            'currency' => 'MMK',
            'is_active' => true,
        ]);
        Inventory::query()->create(['product_variant_id' => $variant->id, 'quantity' => 2]);
        $shipping = ShippingMethod::query()->create([
            'code' => 'cancellation-'.uniqid(),
            'name' => 'Standard delivery',
            'price_minor' => 0,
            'currency' => 'MMK',
            'is_active' => true,
        ]);

        Sanctum::actingAs($customer);
        $order = $this->postJson('/api/v1/cart/items', ['variant_id' => $variant->id, 'quantity' => 1])
            ->assertOk();
        $order = $this->postJson('/api/v1/checkout/confirm', $this->checkoutPayload($idempotencyKey, $shipping->id))
            ->assertCreated()
            ->json('data');

        return [$customer, Order::query()->findOrFail($order['id'])];
    }

    private function checkoutPayload(string $idempotencyKey, ?int $shippingMethodId = null): array
    {
        return [
            'shipping_method_id' => $shippingMethodId ?? ShippingMethod::query()->where('is_active', true)->value('id'),
            'shipping_address' => [
                'recipient_name' => 'Customer',
                'phone' => '0912345678',
                'line1' => '123 Main Street',
                'city' => 'Yangon',
                'country' => 'MM',
            ],
            'idempotency_key' => $idempotencyKey,
        ];
    }
}
