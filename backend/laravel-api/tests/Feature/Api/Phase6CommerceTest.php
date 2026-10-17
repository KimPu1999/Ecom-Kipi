<?php

namespace Tests\Feature\Api;

use App\Models\Category;
use App\Models\Inventory;
use App\Models\Payment;
use App\Models\Product;
use App\Models\Role;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Laravel\Sanctum\Sanctum;
use Tests\TestCase;

class Phase6CommerceTest extends TestCase
{
    use RefreshDatabase;

    public function test_only_one_customer_can_reserve_the_final_unit(): void
    {
        [$variant, $first] = $this->catalogFixture(1);
        $second = User::factory()->create();
        foreach ([$first, $second] as $user) {
            Sanctum::actingAs($user);
            $this->postJson('/api/v1/cart/items', ['variant_id' => $variant->id, 'quantity' => 1])->assertOk();
        }

        Sanctum::actingAs($first);
        $this->postJson('/api/v1/checkout/confirm', $this->checkoutPayload('final-unit'))->assertCreated();
        Sanctum::actingAs($second);
        $this->postJson('/api/v1/checkout/confirm', $this->checkoutPayload('second-buyer'))->assertUnprocessable();

        $this->assertDatabaseHas('inventories', ['product_variant_id' => $variant->id, 'quantity' => 1, 'reserved_quantity' => 1]);
        $this->assertDatabaseCount('orders', 1);
    }

    public function test_verified_stripe_webhook_marks_payment_paid_and_is_idempotent(): void
    {
        [$variant, $user] = $this->catalogFixture(2);
        Sanctum::actingAs($user);
        $this->postJson('/api/v1/cart/items', ['variant_id' => $variant->id, 'quantity' => 1])->assertOk();
        $order = $this->postJson('/api/v1/checkout/confirm', $this->checkoutPayload('webhook-order'))->json('data');
        $payment = Payment::query()->create([
            'order_id' => $order['id'],
            'provider' => 'stripe',
            'provider_payment_id' => 'pi_test_123',
            'status' => 'processing',
            'amount_minor' => $order['grand_total_minor'],
            'currency' => $order['currency'],
        ]);
        $payload = json_encode(['id' => 'evt_test_123', 'type' => 'payment_intent.succeeded', 'data' => ['object' => ['id' => 'pi_test_123', 'status' => 'succeeded', 'amount' => $order['grand_total_minor'], 'amount_received' => $order['grand_total_minor'], 'currency' => strtolower($order['currency'])]]], JSON_THROW_ON_ERROR);
        $timestamp = now()->timestamp;
        $signature = 't='.$timestamp.',v1='.hash_hmac('sha256', $timestamp.'.'.$payload, 'whsec_test');
        config(['commerce.stripe_webhook_secret' => 'whsec_test']);

        $webhook = $this->call('POST', '/api/v1/webhooks/payments/stripe', [], [], [], ['HTTP_STRIPE_SIGNATURE' => $signature, 'CONTENT_TYPE' => 'application/json'], $payload);
        $webhook->assertOk();
        $this->call('POST', '/api/v1/webhooks/payments/stripe', [], [], [], ['HTTP_STRIPE_SIGNATURE' => $signature, 'CONTENT_TYPE' => 'application/json'], $payload)->assertOk();

        $this->assertDatabaseHas('payments', ['id' => $payment->id, 'status' => 'paid']);
        $this->assertDatabaseHas('orders', ['id' => $order['id'], 'payment_status' => 'paid', 'fulfillment_status' => 'confirmed']);
        $this->assertDatabaseHas('inventories', ['product_variant_id' => $variant->id, 'quantity' => 1, 'reserved_quantity' => 0]);
        $this->assertDatabaseHas('inventory_reservations', ['order_id' => $order['id'], 'status' => 'committed']);
        $this->assertDatabaseCount('payment_webhook_events', 1);
    }

    public function test_invalid_payment_webhook_signature_is_rejected(): void
    {
        config(['commerce.stripe_webhook_secret' => 'whsec_test']);
        $this->call('POST', '/api/v1/webhooks/payments/stripe', [], [], [], ['HTTP_STRIPE_SIGNATURE' => 't='.now()->timestamp.',v1=invalid', 'CONTENT_TYPE' => 'application/json'], '{"id":"evt_invalid"}')
            ->assertStatus(400);
    }

    public function test_cash_on_delivery_checkout_creates_pending_cod_payment(): void
    {
        [$variant, $user] = $this->catalogFixture(1);
        Sanctum::actingAs($user);
        $this->postJson('/api/v1/cart/items', ['variant_id' => $variant->id, 'quantity' => 1])->assertOk();

        $order = $this->postJson('/api/v1/checkout/confirm', $this->checkoutPayload('cod-order') + ['payment_method' => 'cod'])
            ->assertCreated()
            ->json('data');

        $this->assertDatabaseHas('payments', ['order_id' => $order['id'], 'provider' => 'cod', 'status' => 'pending']);
        $this->assertDatabaseHas('orders', ['id' => $order['id'], 'payment_status' => 'pending']);
        $this->assertDatabaseCount('order_commissions', 0);
    }

    public function test_manual_online_payment_is_pending_until_authorized_admin_verification(): void
    {
        [$variant, $user] = $this->catalogFixture(1);
        Sanctum::actingAs($user);
        $this->postJson('/api/v1/cart/items', ['variant_id' => $variant->id, 'quantity' => 1])->assertOk();

        $order = $this->postJson('/api/v1/checkout/confirm', $this->checkoutPayload('kbzpay-order') + [
            'payment_method' => 'kbzpay',
            'payment_metadata' => ['sender_phone' => '0912345678', 'transaction_code' => 'KBZ-TEST-1234'],
        ])->assertCreated()->json('data');

        $payment = Payment::query()->where('order_id', $order['id'])->firstOrFail();
        $this->assertSame('kbzpay', $payment->provider);
        $this->assertSame('pending', $payment->status);
        $this->assertSame('KBZ-TEST-1234', $payment->metadata['transaction_code']);

        $admin = User::factory()->create();
        $admin->roles()->attach(Role::query()->create(['name' => 'super_admin', 'label' => 'Super Administrator']));
        Sanctum::actingAs($admin);
        $payment->update(['status' => 'failed']);
        $this->postJson('/api/v1/admin/payments/'.$payment->id.'/verify-manual')
            ->assertUnprocessable();
        $payment->update(['status' => 'pending']);
        $this->postJson('/api/v1/admin/payments/'.$payment->id.'/verify-manual')->assertOk();
        $this->postJson('/api/v1/admin/payments/'.$payment->id.'/verify-manual')->assertOk();

        $this->assertDatabaseHas('payments', ['id' => $payment->id, 'status' => 'paid']);
        $this->assertDatabaseHas('orders', ['id' => $order['id'], 'payment_status' => 'paid', 'fulfillment_status' => 'confirmed']);
        $this->assertDatabaseHas('inventory_reservations', ['order_id' => $order['id'], 'status' => 'committed']);
    }

    public function test_manual_verification_requires_authorization_and_a_real_payment_id(): void
    {
        [$variant, $customer] = $this->catalogFixture(1);
        Sanctum::actingAs($customer);
        $this->postJson('/api/v1/cart/items', ['variant_id' => $variant->id, 'quantity' => 1])->assertOk();
        $order = $this->postJson('/api/v1/checkout/confirm', $this->checkoutPayload('authorization-order') + [
            'payment_method' => 'kbzpay',
            'payment_metadata' => ['sender_phone' => '0912345678', 'transaction_code' => 'KBZ-AUTH-1234'],
        ])->assertCreated()->json('data');
        $payment = Payment::query()->where('order_id', $order['id'])->firstOrFail();

        $this->postJson('/api/v1/admin/payments/'.$payment->id.'/verify-manual')->assertForbidden();

        $admin = User::factory()->create();
        $admin->roles()->attach(Role::query()->create(['name' => 'super_admin', 'label' => 'Super Administrator']));
        Sanctum::actingAs($admin);
        $this->postJson('/api/v1/admin/payments/999999999/verify-manual')->assertNotFound();
        $this->assertDatabaseHas('payments', ['id' => $payment->id, 'status' => 'pending']);
    }

    private function catalogFixture(int $quantity): array
    {
        $user = User::factory()->create();
        $category = Category::query()->create(['name' => 'Phase 6', 'slug' => 'phase-6-'.uniqid()]);
        $product = Product::query()->create(['category_id' => $category->id, 'name' => 'Payment Product', 'slug' => 'payment-'.uniqid(), 'status' => 'published']);
        $variant = $product->variants()->create(['sku' => 'PAY-'.uniqid(), 'price_minor' => 1000, 'currency' => 'MMK', 'is_active' => true]);
        Inventory::query()->create(['product_variant_id' => $variant->id, 'quantity' => $quantity]);

        return [$variant, $user];
    }

    private function checkoutPayload(string $key): array
    {
        return [
            'shipping_address' => [
                'recipient_name' => 'Customer',
                'phone' => '0912345678',
                'line1' => '123 Main Street',
                'city' => 'Yangon',
                'country' => 'MM',
            ],
            'idempotency_key' => $key,
        ];
    }
}
