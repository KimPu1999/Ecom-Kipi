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
}
