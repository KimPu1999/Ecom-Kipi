<?php

namespace Tests\Feature\Api;

use App\Models\Category;
use App\Models\Brand;
use App\Models\Inventory;
use App\Models\Order;
use App\Models\Payment;
use App\Models\Role;
use App\Models\Seller;
use App\Models\SellerOrder;
use App\Models\ShippingMethod;
use App\Models\User;
use App\Services\MarketplaceOrderService;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Laravel\Sanctum\Sanctum;
use Tests\TestCase;

class MarketplaceTest extends TestCase
{
    use RefreshDatabase;

    public function test_public_store_only_exposes_approved_seller_products(): void
    {
        [$seller, $product] = $this->sellerProduct('approved-store', 'active');
        $this->getJson('/api/v1/stores/approved-store')->assertOk()->assertJsonPath('data.store.slug', 'approved-store')->assertJsonPath('data.products.0.id', $product->id);
        $this->getJson('/api/v1/stores')->assertOk()->assertJsonPath('data.0.slug', 'approved-store');
        $this->assertNotNull($seller);
    }

    public function test_seller_catalog_isolation_prevents_cross_seller_mutation(): void
    {
        [$sellerA, $productA] = $this->sellerProduct('seller-a', 'active');
        [, $productB] = $this->sellerProduct('seller-b', 'active');
        Sanctum::actingAs($sellerA->owner);

        $this->getJson('/api/v1/seller/products')->assertOk()->assertJsonPath('meta.total', 1)->assertJsonPath('data.0.id', $productA->id);
        $this->patchJson('/api/v1/seller/products/'.$productB->id, ['name' => 'Should not change'])->assertNotFound();
        $this->deleteJson('/api/v1/seller/products/'.$productB->id)->assertNotFound();
        $this->assertDatabaseHas('products', ['id' => $productB->id, 'name' => $productB->name]);
    }

    public function test_approved_seller_product_can_be_added_to_a_customer_wishlist(): void
    {
        [, $product] = $this->sellerProduct('approved-wishlist', 'approved');
        $customer = User::factory()->create();
        $customer->roles()->attach(Role::query()->create(['name' => 'customer', 'label' => 'Customer']));
        Sanctum::actingAs($customer);

        $this->postJson('/api/v1/wishlist/'.$product->id)->assertCreated();
        $this->getJson('/api/v1/wishlist')->assertOk()->assertJsonPath('data.product_ids.0', $product->id);
    }

    public function test_admin_cannot_publish_a_product_for_an_unapproved_seller(): void
    {
        $admin = User::factory()->create();
        $admin->roles()->attach(Role::query()->create(['name' => 'super_admin', 'label' => 'Super Administrator']));
        $pendingOwner = User::factory()->create();
        $pendingSeller = Seller::query()->create(['owner_user_id' => $pendingOwner->id, 'store_name' => 'Pending Store', 'slug' => 'pending-store', 'status' => Seller::STATUS_PENDING]);
        $category = Category::query()->create(['name' => 'Pending products', 'slug' => 'pending-products']);
        Sanctum::actingAs($admin);

        $this->postJson('/api/v1/admin/products', [
            'category_id' => $category->id,
            'seller_id' => $pendingSeller->id,
            'name' => 'Blocked publication',
            'slug' => 'blocked-publication',
            'status' => 'published',
        ])->assertUnprocessable()->assertJsonValidationErrors(['seller_id']);
    }

    public function test_checkout_defers_commission_until_verified_payment(): void
    {
        [$seller, $product] = $this->sellerProduct('split-store', 'active');
        $customer = User::factory()->create();
        $customer->roles()->attach(Role::query()->create(['name' => 'customer', 'label' => 'Customer']));
        $variant = $product->variants()->first();
        $shipping = ShippingMethod::query()->create(['code' => 'standard-split', 'name' => 'Standard', 'price_minor' => 0, 'currency' => 'MMK', 'is_active' => true]);
        Sanctum::actingAs($customer);
        $this->postJson('/api/v1/cart/items', ['variant_id' => $variant->id, 'quantity' => 2])->assertOk();
        $order = $this->postJson('/api/v1/checkout/confirm', [
            'shipping_method_id' => $shipping->id,
            'shipping_address' => ['recipient_name' => 'Customer', 'phone' => '0900000000', 'line1' => 'Main', 'city' => 'Yangon', 'country' => 'MM'],
            'idempotency_key' => 'marketplace-checkout',
            'payment_method' => 'kbzpay',
            'payment_metadata' => ['sender_phone' => '0900000000', 'transaction_code' => 'KBZ-MARKETPLACE-1'],
        ])->assertCreated()->json('data');

        $sellerOrder = SellerOrder::query()->where('order_id', $order['id'])->firstOrFail();
        $this->assertSame($seller->id, $sellerOrder->seller_id);
        $this->assertSame(2000, $sellerOrder->subtotal_minor);
        $this->assertSame(0, $sellerOrder->commission_minor);
        $this->assertDatabaseCount('order_commissions', 0);
        $this->assertDatabaseHas('order_items', ['order_id' => $order['id'], 'seller_id' => $seller->id]);

        $admin = User::factory()->create();
        $admin->roles()->attach(Role::query()->create(['name' => 'super_admin', 'label' => 'Super Administrator']));
        Sanctum::actingAs($admin);
        $payment = Payment::query()->where('order_id', $order['id'])->firstOrFail();
        $this->postJson('/api/v1/admin/payments/'.$payment->id.'/verify-manual')->assertOk();
        $this->postJson('/api/v1/admin/payments/'.$payment->id.'/verify-manual')->assertOk();

        $this->assertDatabaseHas('order_commissions', [
            'seller_order_item_id' => $sellerOrder->items()->firstOrFail()->id,
            'commission_minor' => 100,
            'rule_source' => 'global_default',
            'status' => 'confirmed',
        ]);
        $this->assertDatabaseCount('order_commissions', 1);
    }

    public function test_seller_earnings_returns_server_snapshot_history_for_only_the_authenticated_seller(): void
    {
        [$sellerA, $productA] = $this->sellerProduct('earnings-store-a', 'active');
        [$sellerB, $productB] = $this->sellerProduct('earnings-store-b', 'active');
        $brand = Brand::query()->create(['name' => 'Earnings Brand', 'slug' => 'earnings-brand']);
        $productA->update(['brand_id' => $brand->id]);

        $createPaidOrder = function (Seller $seller, $product, string $number): Order {
            $variant = $product->variants()->firstOrFail();
            $order = Order::query()->create([
                'user_id' => $seller->owner_user_id,
                'order_number' => $number,
                'shipping_address' => ['line1' => 'Main Street'],
                'subtotal_minor' => 1000,
                'discount_minor' => 0,
                'shipping_minor' => 100,
                'tax_minor' => 0,
                'grand_total_minor' => 1100,
                'currency' => 'MMK',
                'payment_status' => 'paid',
                'fulfillment_status' => 'confirmed',
            ]);
            $order->payments()->create([
                'provider' => 'stripe',
                'provider_payment_id' => 'pi-'.$number,
                'status' => 'paid',
                'amount_minor' => 1100,
                'currency' => 'MMK',
                'paid_at' => now(),
            ]);
            $item = $order->items()->create([
                'product_variant_id' => $variant->id,
                'seller_id' => $seller->id,
                'product_name' => $product->name,
                'sku' => $variant->sku,
                'quantity' => 1,
                'unit_price_minor' => 1000,
                'line_total_minor' => 1000,
            ]);
            $sellerOrder = $order->sellerOrders()->create([
                'seller_id' => $seller->id,
                'order_number' => $number.'-S'.$seller->id,
                'status' => 'confirmed',
                'payment_status' => 'paid',
                'fulfillment_status' => 'confirmed',
                'subtotal_minor' => 1000,
                'shipping_minor' => 0,
                'commission_minor' => 0,
                'net_minor' => 1000,
                'currency' => 'MMK',
            ]);
            $sellerOrder->items()->create([
                'order_item_id' => $item->id,
                'product_variant_id' => $variant->id,
                'product_name' => $product->name,
                'sku' => $variant->sku,
                'quantity' => 1,
                'unit_price_minor' => 1000,
                'line_total_minor' => 1000,
            ]);

            app(MarketplaceOrderService::class)->markPaid($order);

            return $order;
        };

        $orderA = $createPaidOrder($sellerA, $productA, 'EARNINGS-A');
        $createPaidOrder($sellerB, $productB, 'EARNINGS-B');

        Sanctum::actingAs($sellerA->owner);
        $this->getJson('/api/v1/seller/earnings')
            ->assertOk()
            ->assertJsonPath('data.total_sales_minor', 1000)
            ->assertJsonPath('data.commission_deducted_minor', 50)
            ->assertJsonPath('data.commission_history.0.order_id', $orderA->id)
            ->assertJsonPath('data.commission_history.0.brand.name', 'Earnings Brand')
            ->assertJsonPath('data.commission_history.0.percentage_bps', 500)
            ->assertJsonCount(1, 'data.commission_history');
    }

    public function test_seller_dashboard_returns_scoped_overview_metrics_and_trend_views(): void
    {
        [$seller, $product] = $this->sellerProduct('overview-store', 'active');
        Inventory::query()->where('product_variant_id', $product->variants->firstOrFail()->id)->update(['quantity' => 0]);
        Sanctum::actingAs($seller->owner);

        $this->getJson('/api/v1/seller/dashboard?view=monthly')
            ->assertOk()
            ->assertJsonPath('data.metrics.products', 1)
            ->assertJsonPath('data.metrics.total_orders', 0)
            ->assertJsonPath('data.metrics.out_of_stock_products', 1)
            ->assertJsonPath('data.range.view', 'monthly')
            ->assertJsonCount(6, 'data.sales_trend')
            ->assertJsonCount(0, 'data.recent_orders')
            ->assertJsonCount(0, 'data.top_products');
    }

    private function sellerProduct(string $slug, string $status): array
    {
        $owner = User::factory()->create();
        $seller = Seller::query()->create(['owner_user_id' => $owner->id, 'store_name' => ucfirst($slug), 'slug' => $slug, 'status' => $status]);
        $seller->memberships()->create(['user_id' => $owner->id, 'role' => 'owner', 'status' => 'active']);
        $category = Category::query()->create(['name' => $slug, 'slug' => $slug]);
        $product = $seller->products()->create(['category_id' => $category->id, 'name' => 'Seller product '.$slug, 'slug' => $slug.'-product', 'status' => 'published']);
        $variant = $product->variants()->create(['sku' => strtoupper($slug).'-1', 'price_minor' => 1000, 'currency' => 'MMK', 'is_active' => true]);
        Inventory::query()->create(['product_variant_id' => $variant->id, 'quantity' => 10]);

        return [$seller->load('owner'), $product->load('variants')];
    }
}
