<?php

namespace Tests\Feature\Api;

use App\Models\Category;
use App\Models\Inventory;
use App\Models\Product;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Laravel\Sanctum\Sanctum;
use Tests\TestCase;

class Phase4CheckoutTest extends TestCase
{
    use RefreshDatabase;

    public function test_authenticated_customer_can_preview_a_non_empty_cart(): void
    {
        $user = User::factory()->create();
        $category = Category::query()->create(['name' => 'Checkout', 'slug' => 'checkout']);
        $product = Product::query()->create(['category_id' => $category->id, 'name' => 'Preview Product', 'slug' => 'preview-product', 'status' => 'published']);
        $variant = $product->variants()->create(['sku' => 'PREVIEW-1', 'price_minor' => 1000, 'currency' => 'MMK', 'is_active' => true]);
        Inventory::query()->create(['product_variant_id' => $variant->id, 'quantity' => 5]);

        Sanctum::actingAs($user);
        $this->postJson('/api/v1/cart/items', ['variant_id' => $variant->id, 'quantity' => 1])->assertSuccessful();

        $this->postJson('/api/v1/checkout/preview')
            ->assertSuccessful()
            ->assertJsonPath('data.item_count', 1)
            ->assertJsonStructure(['data' => ['subtotal_minor', 'shipping_minor', 'tax_minor', 'grand_total_minor', 'currency']]);
    }

    public function test_checkout_preview_and_confirmation_sum_all_cart_lines(): void
    {
        $user = User::factory()->create();
        $category = Category::query()->create(['name' => 'Checkout totals', 'slug' => 'checkout-totals']);
        $demo = Product::query()->create(['category_id' => $category->id, 'name' => 'Demo', 'slug' => 'demo-total', 'status' => 'published']);
        $shirt = Product::query()->create(['category_id' => $category->id, 'name' => 'T-Shirt', 'slug' => 't-shirt-total', 'status' => 'published']);
        $demoVariant = $demo->variants()->create(['sku' => 'DEMO-TOTAL', 'price_minor' => 200000, 'currency' => 'MMK', 'is_active' => true]);
        $shirtVariant = $shirt->variants()->create(['sku' => 'SHIRT-TOTAL', 'price_minor' => 15000, 'currency' => 'MMK', 'is_active' => true]);
        Inventory::query()->create(['product_variant_id' => $demoVariant->id, 'quantity' => 2]);
        Inventory::query()->create(['product_variant_id' => $shirtVariant->id, 'quantity' => 2]);

        Sanctum::actingAs($user);
        $this->postJson('/api/v1/cart/items', ['variant_id' => $demoVariant->id, 'quantity' => 1])->assertSuccessful();
        $this->postJson('/api/v1/cart/items', ['variant_id' => $shirtVariant->id, 'quantity' => 1])->assertSuccessful();

        $this->postJson('/api/v1/checkout/preview')
            ->assertSuccessful()
            ->assertJsonPath('data.item_count', 2)
            ->assertJsonPath('data.subtotal_minor', 215000)
            ->assertJsonPath('data.grand_total_minor', 215000);

        $orderId = $this->postJson('/api/v1/checkout/confirm', [
            'shipping_address' => [
                'recipient_name' => 'Customer',
                'phone' => '0912345678',
                'line1' => 'Main Street',
                'city' => 'Yangon',
                'country' => 'MM',
            ],
            'idempotency_key' => 'checkout-total-lines',
        ])->assertCreated()->json('data.id');

        $this->assertDatabaseHas('orders', [
            'id' => $orderId,
            'subtotal_minor' => 215000,
            'grand_total_minor' => 215000,
        ]);
    }
}
