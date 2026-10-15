<?php

namespace Tests\Feature\Api;

use App\Models\Category;
use App\Models\Coupon;
use App\Models\Inventory;
use App\Models\Order;
use App\Models\Product;
use App\Models\Role;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Hash;
use Laravel\Sanctum\Sanctum;
use Tests\TestCase;

class Phase3Test extends TestCase
{
    use RefreshDatabase;

    public function test_customer_can_register_and_login(): void
    {
        $response = $this->postJson('/api/v1/auth/register', [
            'name' => 'New Customer',
            'email' => 'new@example.com',
            'password' => 'password123',
            'password_confirmation' => 'password123',
        ]);

        $response->assertCreated()->assertJsonPath('success', true)->assertJsonPath('data.user.email', 'new@example.com');

        $this->postJson('/api/v1/auth/login', [
            'email' => 'new@example.com',
            'password' => 'password123',
        ])->assertOk()->assertJsonPath('data.token_type', 'Bearer');
    }

    public function test_customer_cannot_access_admin_endpoints(): void
    {
        $customer = User::factory()->create();
        $customer->roles()->attach(Role::query()->create(['name' => 'customer', 'label' => 'Customer']));
        Sanctum::actingAs($customer);

        $this->getJson('/api/v1/admin/products')->assertForbidden();
    }

    public function test_products_can_be_filtered_and_paginated(): void
    {
        $category = Category::query()->create(['name' => 'Shoes', 'slug' => 'shoes']);
        $product = Product::query()->create([
            'category_id' => $category->id,
            'name' => 'Running Shoe',
            'slug' => 'running-shoe',
            'status' => 'published',
        ]);
        $variant = $product->variants()->create(['sku' => 'SHOE-1', 'price_minor' => 25000, 'currency' => 'MMK', 'is_active' => true]);
        Inventory::query()->create(['product_variant_id' => $variant->id, 'quantity' => 4]);

        $this->getJson('/api/v1/products?q=running&per_page=1')
            ->assertOk()
            ->assertJsonPath('success', true)
            ->assertJsonPath('meta.total', 1)
            ->assertJsonPath('data.0.slug', 'running-shoe');
    }

    public function test_cart_and_transactional_idempotent_order_creation(): void
    {
        [$customer, $variant] = $this->catalogFixture();
        Sanctum::actingAs($customer);

        $this->postJson('/api/v1/cart/items', ['variant_id' => $variant->id, 'quantity' => 2])->assertOk();
        $payload = [
            'shipping_address' => [
                'recipient_name' => 'Customer',
                'phone' => '0912345678',
                'line1' => '123 Main Street',
                'city' => 'Yangon',
                'country' => 'MM',
            ],
            'idempotency_key' => 'checkout-001',
        ];

        $first = $this->postJson('/api/v1/orders', $payload)->assertCreated();
        $second = $this->postJson('/api/v1/orders', $payload)->assertCreated();

        $first->assertJsonPath('data.id', $second->json('data.id'));
        $this->assertDatabaseCount('orders', 1);
        $this->assertDatabaseHas('inventories', ['product_variant_id' => $variant->id, 'reserved_quantity' => 2]);
    }

    public function test_customer_cannot_read_another_customers_order(): void
    {
        [$owner, $variant] = $this->catalogFixture();
        Sanctum::actingAs($owner);
        $this->postJson('/api/v1/cart/items', ['variant_id' => $variant->id, 'quantity' => 1]);
        $orderId = $this->postJson('/api/v1/orders', [
            'shipping_address' => [
                'recipient_name' => 'Owner',
                'phone' => '0912345678',
                'line1' => '123 Main Street',
                'city' => 'Yangon',
                'country' => 'MM',
            ],
        ])->json('data.id');

        $other = User::factory()->create();
        Sanctum::actingAs($other);
        $this->getJson("/api/v1/orders/{$orderId}")->assertNotFound();
    }

    public function test_customer_can_manage_wishlist_and_review_a_paid_product(): void
    {
        [$customer, $variant] = $this->catalogFixture();
        Sanctum::actingAs($customer);

        $this->postJson('/api/v1/wishlist/'.$variant->product_id)->assertCreated();
        $this->getJson('/api/v1/wishlist')->assertOk()->assertJsonPath('data.product_ids.0', $variant->product_id);
        $this->deleteJson('/api/v1/wishlist/'.$variant->product_id)->assertOk();

        $this->postJson('/api/v1/cart/items', ['variant_id' => $variant->id, 'quantity' => 1])->assertOk();
        $orderId = $this->postJson('/api/v1/orders', [
            'shipping_address' => ['recipient_name' => 'Customer', 'phone' => '0912345678', 'line1' => 'Main', 'city' => 'Yangon', 'country' => 'MM'],
        ])->assertCreated()->json('data.id');
        Order::query()->whereKey($orderId)->update(['payment_status' => 'paid']);

        $this->postJson('/api/v1/products/'.$variant->product_id.'/reviews', ['rating' => 5, 'title' => 'Great', 'body' => 'Exactly as described.'])
            ->assertCreated()->assertJsonPath('data.rating', 5);
        $this->getJson('/api/v1/products/'.$variant->product_id.'/reviews')->assertOk()->assertJsonPath('data.summary.review_count', 1);
    }

    public function test_customer_can_apply_a_coupon_during_checkout(): void
    {
        [$customer, $variant] = $this->catalogFixture();
        Coupon::query()->create([
            'code' => 'SAVE10',
            'type' => 'percentage',
            'value' => 1000,
            'per_user_limit' => 1,
            'is_active' => true,
        ]);
        Sanctum::actingAs($customer);

        $this->postJson('/api/v1/cart/items', ['variant_id' => $variant->id, 'quantity' => 1])->assertOk();
        $this->postJson('/api/v1/checkout/preview', ['coupon_code' => 'save10'])
            ->assertOk()
            ->assertJsonPath('data.discount_minor', 100)
            ->assertJsonPath('data.coupon_code', 'SAVE10');

        $orderId = $this->postJson('/api/v1/orders', [
            'coupon_code' => 'save10',
            'shipping_address' => ['recipient_name' => 'Customer', 'phone' => '0912345678', 'line1' => 'Main', 'city' => 'Yangon', 'country' => 'MM'],
        ])->assertCreated()->json('data.id');

        $this->assertDatabaseHas('orders', ['id' => $orderId, 'coupon_code' => 'SAVE10', 'discount_minor' => 100]);
        $this->assertDatabaseHas('coupon_usages', ['coupon_id' => Coupon::query()->where('code', 'SAVE10')->value('id'), 'order_id' => $orderId]);
        $this->assertDatabaseHas('coupons', ['code' => 'SAVE10', 'usage_count' => 1]);
    }

    private function catalogFixture(): array
    {
        $customer = User::factory()->create(['password' => Hash::make('password123')]);
        $customer->roles()->attach(Role::query()->create(['name' => 'customer', 'label' => 'Customer']));
        $category = Category::query()->create(['name' => 'General', 'slug' => 'general']);
        $product = Product::query()->create([
            'category_id' => $category->id,
            'name' => 'Test Product',
            'slug' => 'test-product',
            'status' => 'published',
        ]);
        $variant = $product->variants()->create(['sku' => 'TEST-1', 'price_minor' => 1000, 'currency' => 'MMK', 'is_active' => true]);
        Inventory::query()->create(['product_variant_id' => $variant->id, 'quantity' => 10]);

        return [$customer, $variant];
    }
}
