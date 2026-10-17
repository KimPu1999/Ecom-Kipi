<?php

namespace Tests\Feature\Api;

use App\Models\Category;
use App\Models\Inventory;
use App\Models\Payment;
use App\Models\Product;
use App\Models\Role;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Http\UploadedFile;
use Illuminate\Support\Facades\Storage;
use Laravel\Sanctum\Sanctum;
use Tests\TestCase;

class PaymentReceiptTest extends TestCase
{
    use RefreshDatabase;

    public function test_customer_can_submit_a_receipt_without_marking_payment_paid_and_duplicate_submission_is_idempotent(): void
    {
        [$customer, $payment] = $this->paymentFixture();
        Storage::fake('local');
        Sanctum::actingAs($customer);

        $payload = [
            'sender_name' => 'Customer Sender',
            'sender_phone' => '0912345678',
            'transaction_code' => 'KBZ-RECEIPT-001',
            'receipt' => UploadedFile::fake()->image('receipt.jpg'),
        ];

        $this->post('/api/v1/orders/'.$payment->order_id.'/payments/'.$payment->id.'/receipt', $payload)
            ->assertOk()
            ->assertJsonPath('data.status', 'pending')
            ->assertJsonPath('data.receipt.status', 'submitted')
            ->assertJsonPath('data.receipt.has_file', true);

        $payment->refresh();
        $storedPath = data_get($payment->metadata, 'receipt.storage_path');
        $this->assertSame('pending', $payment->status);
        $this->assertNotEmpty($storedPath);
        Storage::disk('local')->assertExists($storedPath);

        $this->post('/api/v1/orders/'.$payment->order_id.'/payments/'.$payment->id.'/receipt', [
            ...$payload,
            'receipt' => UploadedFile::fake()->image('duplicate.png'),
        ])->assertOk()->assertJsonPath('data.receipt.status', 'submitted');

        $this->assertSame($storedPath, data_get($payment->fresh()->metadata, 'receipt.storage_path'));
        $this->assertCount(1, Storage::disk('local')->allFiles('payment-receipts'));
    }

    public function test_invalid_receipt_type_and_other_customer_access_are_rejected(): void
    {
        [$customer, $payment] = $this->paymentFixture();
        Sanctum::actingAs($customer);

        $this->post('/api/v1/orders/'.$payment->order_id.'/payments/'.$payment->id.'/receipt', [
            'sender_name' => 'Customer Sender',
            'receipt' => UploadedFile::fake()->create('receipt.pdf', 100, 'application/pdf'),
        ])->assertUnprocessable();

        $other = User::factory()->create();
        Sanctum::actingAs($other);
        $this->post('/api/v1/orders/'.$payment->order_id.'/payments/'.$payment->id.'/receipt', [
            'sender_name' => 'Other Customer',
            'receipt' => UploadedFile::fake()->image('receipt.jpg'),
        ])->assertNotFound();
    }

    public function test_super_admin_can_reject_and_approve_receipts_with_private_file_access(): void
    {
        [$customer, $payment] = $this->paymentFixture();
        Storage::fake('local');
        Sanctum::actingAs($customer);
        $this->post('/api/v1/orders/'.$payment->order_id.'/payments/'.$payment->id.'/receipt', [
            'sender_name' => 'Customer Sender',
            'transaction_code' => 'KBZ-RECEIPT-002',
            'receipt' => UploadedFile::fake()->image('receipt.png'),
        ])->assertOk();

        $admin = User::factory()->create();
        $admin->roles()->attach(Role::query()->create(['name' => 'super_admin', 'label' => 'Super Administrator']));
        Sanctum::actingAs($admin);

        $this->getJson('/api/v1/admin/payment-receipts')
            ->assertOk()
            ->assertJsonPath('data.0.payment_id', $payment->id)
            ->assertJsonPath('data.0.status', 'submitted');
        $this->get('/api/v1/admin/payments/'.$payment->id.'/receipt')->assertOk()->assertHeader('content-type', 'image/png');

        $this->postJson('/api/v1/admin/payments/'.$payment->id.'/receipt/reject', [])
            ->assertUnprocessable();
        $this->postJson('/api/v1/admin/payments/'.$payment->id.'/receipt/reject', ['rejection_reason' => 'The transfer reference is not readable.'])
            ->assertOk()
            ->assertJsonPath('data.receipt.status', 'rejected');
        $this->assertDatabaseHas('payments', ['id' => $payment->id, 'status' => 'pending']);

        Sanctum::actingAs($customer);
        $this->post('/api/v1/orders/'.$payment->order_id.'/payments/'.$payment->id.'/receipt', [
            'sender_name' => 'Customer Sender',
            'receipt' => UploadedFile::fake()->image('replacement.jpg'),
        ])->assertOk()->assertJsonPath('data.receipt.status', 'submitted');

        Sanctum::actingAs($admin);
        $this->postJson('/api/v1/admin/payments/'.$payment->id.'/receipt/approve')
            ->assertOk()
            ->assertJsonPath('data.status', 'paid')
            ->assertJsonPath('data.receipt.status', 'approved');
        $this->assertDatabaseHas('payments', ['id' => $payment->id, 'status' => 'paid']);
        $this->assertDatabaseHas('orders', ['id' => $payment->order_id, 'payment_status' => 'paid']);
    }

    private function paymentFixture(): array
    {
        $customer = User::factory()->create();
        $category = Category::query()->create(['name' => 'Receipts', 'slug' => 'receipts-'.uniqid()]);
        $product = Product::query()->create(['category_id' => $category->id, 'name' => 'Receipt Product', 'slug' => 'receipt-product-'.uniqid(), 'status' => 'published']);
        $variant = $product->variants()->create(['sku' => 'RECEIPT-'.uniqid(), 'price_minor' => 1000, 'currency' => 'MMK', 'is_active' => true]);
        Inventory::query()->create(['product_variant_id' => $variant->id, 'quantity' => 5]);

        Sanctum::actingAs($customer);
        $this->postJson('/api/v1/cart/items', ['variant_id' => $variant->id, 'quantity' => 1])->assertOk();
        $order = $this->postJson('/api/v1/checkout/confirm', [
            'shipping_address' => ['recipient_name' => 'Customer', 'phone' => '0912345678', 'line1' => 'Main Street', 'city' => 'Yangon', 'country' => 'MM'],
            'payment_method' => 'kbzpay',
            'payment_metadata' => ['sender_phone' => '0912345678', 'transaction_code' => 'KBZ-INITIAL-001'],
        ])->assertCreated()->json('data');

        return [$customer, Payment::query()->where('order_id', $order['id'])->firstOrFail()];
    }
}
