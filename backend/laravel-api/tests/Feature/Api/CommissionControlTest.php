<?php

namespace Tests\Feature\Api;

use App\Models\Brand;
use App\Models\Category;
use App\Models\CommissionAdjustment;
use App\Models\CommissionRule;
use App\Models\Inventory;
use App\Models\MarketplaceSetting;
use App\Models\Order;
use App\Models\Refund;
use App\Models\Role;
use App\Models\Seller;
use App\Models\SellerOrder;
use App\Models\User;
use App\Services\CommissionService;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Schema;
use Illuminate\Validation\ValidationException;
use Laravel\Sanctum\Sanctum;
use Tests\TestCase;

class CommissionControlTest extends TestCase
{
    use RefreshDatabase;

    public function test_global_default_is_five_percent_and_can_be_disabled_for_new_orders(): void
    {
        $service = app(CommissionService::class);
        $owner = User::factory()->create();
        $seller = Seller::query()->create(['owner_user_id' => $owner->id, 'store_name' => 'Default Seller', 'slug' => 'default-seller', 'status' => 'active']);

        $this->assertSame(500, $service->settings()['default_percentage_bps']);
        $this->assertSame(500, $service->resolveRule($seller->id, null, 'MMK')['percentage_bps']);
        $service->updateSettings(false, 500);
        $decision = $service->resolveRule($seller->id, null, 'MMK');

        $this->assertSame(0, $decision['percentage_bps']);
        $this->assertSame('global_disabled', $decision['rule_source']);
    }

    public function test_settings_endpoint_returns_configured_defaults_when_setting_record_is_missing(): void
    {
        MarketplaceSetting::query()->delete();
        Sanctum::actingAs($this->superAdmin());

        $this->getJson('/api/v1/admin/marketplace/commission-settings')
            ->assertOk()
            ->assertJsonPath('data.default_percentage_bps', 500)
            ->assertJsonPath('data.enabled', true)
            ->assertJsonPath('data.persisted', false)
            ->assertJsonPath('data.requires_migration', false);
    }

    public function test_settings_endpoint_returns_safe_defaults_when_storage_table_is_missing(): void
    {
        Schema::partialMock()
            ->shouldReceive('hasTable')
            ->with('marketplace_settings')
            ->once()
            ->andReturnFalse();
        Sanctum::actingAs($this->superAdmin());

        $this->getJson('/api/v1/admin/marketplace/commission-settings')
            ->assertOk()
            ->assertJsonPath('data.default_percentage_bps', 500)
            ->assertJsonPath('data.enabled', true)
            ->assertJsonPath('data.persisted', false)
            ->assertJsonPath('data.requires_migration', true);
    }

    public function test_super_admin_can_save_and_reload_global_settings(): void
    {
        Sanctum::actingAs($this->superAdmin());

        $this->putJson('/api/v1/admin/marketplace/commission-settings', [
            'commission_enabled' => false,
            'default_percentage_bps' => 725,
        ])->assertOk()
            ->assertJsonPath('data.enabled', false)
            ->assertJsonPath('data.default_percentage_bps', 725)
            ->assertJsonPath('data.persisted', true);

        $this->getJson('/api/v1/admin/marketplace/commission-settings')
            ->assertOk()
            ->assertJsonPath('data.enabled', false)
            ->assertJsonPath('data.default_percentage_bps', 725)
            ->assertJsonPath('data.persisted', true);
    }

    public function test_super_admin_can_create_update_and_reload_seller_brand_rules(): void
    {
        [$seller, $product] = $this->sellerProduct('rule-api-store');
        $brand = Brand::query()->create(['name' => 'Rule API Brand', 'slug' => 'rule-api-brand']);
        $product->update(['brand_id' => $brand->id]);
        Sanctum::actingAs($this->superAdmin());

        $sellerRule = $this->postJson('/api/v1/admin/marketplace/commission-rules', [
            'seller_id' => $seller->id,
            'percentage_bps' => 900,
            'currency' => 'MMK',
        ])->assertCreated()->json('data');
        $brandRule = $this->postJson('/api/v1/admin/marketplace/commission-rules', [
            'seller_id' => $seller->id,
            'brand_id' => $brand->id,
            'percentage_bps' => 1500,
            'currency' => 'MMK',
        ])->assertCreated()->json('data');

        $this->putJson('/api/v1/admin/marketplace/commission-rules/'.$brandRule['id'], [
            'seller_id' => $seller->id,
            'brand_id' => $brand->id,
            'percentage_bps' => 1500,
            'currency' => 'MMK',
            'is_active' => false,
        ])->assertOk()->assertJsonPath('data.is_active', false);

        $this->getJson('/api/v1/admin/marketplace/commission-rules?seller_id='.$seller->id)
            ->assertOk()
            ->assertJsonPath('meta.total', 2);
        $this->assertDatabaseHas('commission_rules', ['id' => $sellerRule['id'], 'percentage_bps' => 900]);
        $this->assertSame('seller_brand_disabled', app(CommissionService::class)->resolveRule($seller->id, $brand->id, 'MMK')['rule_source']);
    }

    public function test_invalid_commission_rate_is_rejected_server_side(): void
    {
        [$seller] = $this->sellerProduct('invalid-rate-store');
        Sanctum::actingAs($this->superAdmin());

        $this->postJson('/api/v1/admin/marketplace/commission-rules', [
            'seller_id' => $seller->id,
            'percentage_bps' => 10001,
            'currency' => 'MMK',
        ])->assertUnprocessable()->assertJsonValidationErrors(['percentage_bps']);
    }

    public function test_seller_and_brand_priority_and_disabled_scope_are_enforced(): void
    {
        [$seller, $product] = $this->sellerProduct('commission-priority');
        $brand = Brand::query()->create(['name' => 'Priority Brand', 'slug' => 'priority-brand']);
        $product->update(['brand_id' => $brand->id]);
        CommissionRule::query()->create(['seller_id' => $seller->id, 'brand_id' => null, 'category_id' => null, 'percentage_bps' => 1200, 'fixed_minor' => 0, 'currency' => 'MMK', 'is_active' => true]);
        $brandRule = CommissionRule::query()->create(['seller_id' => $seller->id, 'brand_id' => $brand->id, 'category_id' => null, 'percentage_bps' => 2500, 'fixed_minor' => 0, 'currency' => 'MMK', 'is_active' => true]);
        $service = app(CommissionService::class);

        $this->assertSame(2500, $service->resolveRule($seller->id, $brand->id, 'MMK')['percentage_bps']);
        $brandRule->update(['is_active' => false]);
        $disabled = $service->resolveRule($seller->id, $brand->id, 'MMK');
        $this->assertSame(0, $disabled['percentage_bps']);
        $this->assertSame('seller_brand_disabled', $disabled['rule_source']);
    }

    public function test_brand_rule_must_belong_to_the_selected_seller(): void
    {
        [$sellerA] = $this->sellerProduct('seller-a-commission');
        [, $otherProduct] = $this->sellerProduct('seller-b-commission');
        $brand = Brand::query()->create(['name' => 'Other Seller Brand', 'slug' => 'other-seller-brand']);
        $otherProduct->update(['brand_id' => $brand->id]);
        $admin = $this->superAdmin();
        Sanctum::actingAs($admin);

        $this->postJson('/api/v1/admin/marketplace/commission-rules', [
            'seller_id' => $sellerA->id,
            'brand_id' => $brand->id,
            'percentage_bps' => 1000,
            'currency' => 'MMK',
        ])->assertUnprocessable()->assertJsonValidationErrors(['brand_id']);
    }

    public function test_non_super_admin_cannot_change_commission_settings_or_rules(): void
    {
        $admin = User::factory()->create();
        $admin->roles()->attach(Role::query()->create(['name' => 'admin', 'label' => 'Administrator']));
        Sanctum::actingAs($admin);

        $this->getJson('/api/v1/admin/marketplace/commission-settings')->assertForbidden();
        $this->putJson('/api/v1/admin/marketplace/commission-settings', [
            'commission_enabled' => false,
            'default_percentage_bps' => 0,
        ])->assertForbidden();
    }

    public function test_commission_cannot_be_confirmed_for_an_unpaid_order(): void
    {
        [$seller, $product] = $this->sellerProduct('unpaid-commission-store');
        [$order, $sellerOrder] = $this->sellerOrder($seller, $product->variants()->firstOrFail());
        $order->update(['payment_status' => 'pending']);
        $sellerOrder->update(['payment_status' => 'pending']);

        try {
            app(CommissionService::class)->confirmSellerOrder($sellerOrder);
            $this->fail('Expected unpaid commission confirmation to be rejected.');
        } catch (ValidationException $exception) {
            $this->assertArrayHasKey('payment', $exception->errors());
        }

        $this->assertDatabaseCount('order_commissions', 0);
    }

    public function test_verified_confirmation_is_idempotent_and_historical_snapshot_does_not_change(): void
    {
        [$seller, $product] = $this->sellerProduct('snapshot-store');
        [$order, $sellerOrder] = $this->sellerOrder($seller, $product->variants()->firstOrFail());
        $service = app(CommissionService::class);

        $service->confirmSellerOrder($sellerOrder);
        $snapshot = $sellerOrder->commissions()->firstOrFail();
        $this->assertSame(50, $snapshot->commission_minor);
        $this->assertSame('confirmed', $snapshot->status);
        $service->updateSettings(true, 900);
        $service->confirmSellerOrder($sellerOrder->fresh());

        $this->assertDatabaseCount('order_commissions', 1);
        $this->assertDatabaseHas('order_commissions', ['id' => $snapshot->id, 'commission_minor' => 50, 'percentage_bps' => 500]);
        $this->assertSame($order->id, $sellerOrder->order_id);
    }

    public function test_refund_reversal_is_audited_and_duplicate_processing_is_idempotent(): void
    {
        [$seller, $product] = $this->sellerProduct('refund-store');
        [$order, $sellerOrder] = $this->sellerOrder($seller, $product->variants()->firstOrFail());
        $service = app(CommissionService::class);
        $service->confirmSellerOrder($sellerOrder);
        $refund = Refund::query()->create(['order_id' => $order->id, 'status' => 'succeeded', 'amount_minor' => 1000, 'currency' => 'MMK']);

        $service->reverseForRefund($refund);
        $service->reverseForRefund($refund->fresh());

        $this->assertDatabaseCount('commission_adjustments', 1);
        $this->assertDatabaseHas('commission_adjustments', ['refund_id' => $refund->id, 'amount_minor' => 50, 'type' => 'reversal']);
    }

    public function test_cancellation_reverses_confirmed_commission_once(): void
    {
        [$seller, $product] = $this->sellerProduct('cancellation-store');
        [$order, $sellerOrder] = $this->sellerOrder($seller, $product->variants()->firstOrFail());
        $service = app(CommissionService::class);
        $service->confirmSellerOrder($sellerOrder);

        $service->reverseForCancellation($order, $order->user_id);
        $service->reverseForCancellation($order->fresh(), $order->user_id);

        $this->assertDatabaseHas('commission_adjustments', ['order_commission_id' => $sellerOrder->commissions()->firstOrFail()->id, 'type' => 'cancellation', 'amount_minor' => 50]);
        $this->assertDatabaseCount('commission_adjustments', 1);
    }

    private function sellerProduct(string $slug): array
    {
        $owner = User::factory()->create();
        $seller = Seller::query()->create(['owner_user_id' => $owner->id, 'store_name' => ucfirst($slug), 'slug' => $slug, 'status' => 'active']);
        $seller->memberships()->create(['user_id' => $owner->id, 'role' => 'owner', 'status' => 'active']);
        $category = Category::query()->create(['name' => $slug, 'slug' => $slug]);
        $product = $seller->products()->create(['category_id' => $category->id, 'name' => 'Commission product', 'slug' => $slug.'-product', 'status' => 'published']);
        $variant = $product->variants()->create(['sku' => strtoupper($slug).'-1', 'price_minor' => 1000, 'currency' => 'MMK', 'is_active' => true]);
        Inventory::query()->create(['product_variant_id' => $variant->id, 'quantity' => 10]);

        return [$seller, $product];
    }

    private function sellerOrder(Seller $seller, $variant): array
    {
        $customer = User::factory()->create();
        $order = Order::query()->create([
            'user_id' => $customer->id,
            'order_number' => 'ORD-COMMISSION-'.uniqid(),
            'shipping_address' => ['line1' => 'Main', 'city' => 'Yangon', 'country' => 'MM'],
            'billing_address' => ['line1' => 'Main', 'city' => 'Yangon', 'country' => 'MM'],
            'subtotal_minor' => 1000,
            'grand_total_minor' => 1100,
            'shipping_minor' => 100,
            'currency' => 'MMK',
            'payment_status' => 'paid',
            'fulfillment_status' => 'confirmed',
        ]);
        $order->payments()->create([
            'provider' => 'kbzpay',
            'status' => 'paid',
            'amount_minor' => 1100,
            'currency' => 'MMK',
            'paid_at' => now(),
        ]);
        $orderItem = $order->items()->create(['product_variant_id' => $variant->id, 'seller_id' => $seller->id, 'product_name' => 'Commission product', 'sku' => $variant->sku, 'quantity' => 1, 'unit_price_minor' => 1000, 'line_total_minor' => 1000]);
        $sellerOrder = $order->sellerOrders()->create(['seller_id' => $seller->id, 'order_number' => $order->order_number.'-S'.$seller->id, 'status' => 'confirmed', 'payment_status' => 'paid', 'fulfillment_status' => 'confirmed', 'subtotal_minor' => 1000, 'shipping_minor' => 0, 'commission_minor' => 0, 'net_minor' => 1000, 'currency' => 'MMK']);
        $sellerOrder->items()->create(['order_item_id' => $orderItem->id, 'product_variant_id' => $variant->id, 'product_name' => 'Commission product', 'sku' => $variant->sku, 'quantity' => 1, 'unit_price_minor' => 1000, 'line_total_minor' => 1000]);

        return [$order, $sellerOrder];
    }

    private function superAdmin(): User
    {
        $admin = User::factory()->create();
        $admin->roles()->attach(Role::query()->create(['name' => 'super_admin', 'label' => 'Super Administrator']));

        return $admin;
    }
}
