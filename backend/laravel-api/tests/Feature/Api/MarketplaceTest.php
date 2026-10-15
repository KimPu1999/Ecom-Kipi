<?php

namespace Tests\Feature\Api;

use App\Models\Category;
use App\Models\Inventory;
use App\Models\Role;
use App\Models\Seller;
use App\Models\SellerOrder;
use App\Models\ShippingMethod;
use App\Models\User;
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

    public function test_checkout_creates_seller_order_and_commission_snapshot(): void
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
        ])->assertCreated()->json('data');

        $sellerOrder = SellerOrder::query()->where('order_id', $order['id'])->firstOrFail();
        $this->assertSame($seller->id, $sellerOrder->seller_id);
        $this->assertSame(2000, $sellerOrder->subtotal_minor);
        $this->assertSame(100, $sellerOrder->commission_minor);
        $this->assertDatabaseHas('order_items', ['order_id' => $order['id'], 'seller_id' => $seller->id]);
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
