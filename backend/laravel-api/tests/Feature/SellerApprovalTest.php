<?php

namespace Tests\Feature;

use App\Models\Category;
use App\Models\Order;
use App\Models\Permission;
use App\Models\Product;
use App\Models\Role;
use App\Models\Seller;
use App\Models\SellerApplication;
use App\Models\SellerOrder;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Http\UploadedFile;
use Illuminate\Support\Facades\Storage;
use Laravel\Sanctum\Sanctum;
use Tests\TestCase;

class SellerApprovalTest extends TestCase
{
    use RefreshDatabase;

    public function test_new_applicant_cannot_sell_before_approval_and_documents_are_private(): void
    {
        Storage::fake('local');
        $customer = $this->customer();
        $category = Category::query()->create(['name' => 'Pending category', 'slug' => 'pending-category']);
        Sanctum::actingAs($customer);

        $response = $this->post('/api/v1/seller/applications', [
            'business_name' => 'Pending Shop',
            'business_type' => 'Retail',
            'business_details' => ['registration_number' => 'REG-001'],
            'contact_details' => ['email' => 'shop@example.com', 'phone' => '0900000000'],
            'documents' => [UploadedFile::fake()->create('license.pdf', 10, 'application/pdf')],
            'document_types' => ['business_license'],
        ], ['Accept' => 'application/json']);

        $response->assertCreated()->assertJsonPath('data.application_status', SellerApplication::STATUS_PENDING);
        $application = SellerApplication::query()->firstOrFail();
        $document = $application->documents()->firstOrFail();
        $this->assertArrayNotHasKey('storage_path', $document->toArray());
        Storage::disk('local')->assertExists($document->storage_path);

        $this->postJson('/api/v1/seller/products', [
            'category_id' => $category->id,
            'name' => 'Blocked product',
            'slug' => 'blocked-product',
            'status' => 'published',
        ])->assertForbidden();
        $this->assertDatabaseMissing('products', ['slug' => 'blocked-product']);
    }

    public function test_customer_cannot_approve_an_application_and_only_super_admin_can_approve(): void
    {
        $customer = $this->customer();
        $application = $this->submitApplication($customer);
        Sanctum::actingAs($customer);

        $this->postJson('/api/v1/admin/marketplace/applications/'.$application->id.'/approve', [
            'store_name' => 'Self Approved',
            'slug' => 'self-approved',
        ])->assertForbidden();

        $admin = User::factory()->create();
        $adminRole = Role::query()->create(['name' => 'admin', 'label' => 'Administrator']);
        $adminRole->permissions()->attach(Permission::query()->firstOrCreate(['name' => 'manage_marketplace'], ['label' => 'Manage marketplace']));
        $admin->roles()->attach($adminRole);
        Sanctum::actingAs($admin);
        $this->postJson('/api/v1/admin/marketplace/applications/'.$application->id.'/approve', [
            'store_name' => 'Admin Approved',
            'slug' => 'admin-approved',
        ])->assertForbidden();

        $superAdmin = $this->superAdmin();
        Sanctum::actingAs($superAdmin);
        Role::query()->firstOrCreate(['name' => 'seller'], ['label' => 'Seller']);
        $unapprovedUser = $this->customer();
        $this->patchJson('/api/v1/admin/users/'.$unapprovedUser->id.'/roles', ['roles' => ['seller']])->assertUnprocessable();

        $this->postJson('/api/v1/admin/marketplace/applications/'.$application->id.'/approve', [
            'store_name' => 'Approved Shop',
            'slug' => 'approved-shop',
            'support_email' => 'approved@example.com',
        ])->assertOk()->assertJsonPath('data.status', Seller::STATUS_APPROVED);

        $this->assertDatabaseHas('seller_applications', ['id' => $application->id, 'application_status' => SellerApplication::STATUS_APPROVED]);
        $this->assertDatabaseHas('seller_approval_history', ['seller_application_id' => $application->id, 'action' => 'approved', 'to_status' => SellerApplication::STATUS_APPROVED]);
        $this->assertDatabaseHas('audit_logs', ['action' => 'seller.application_approved', 'resource_type' => Seller::class]);
    }

    public function test_rejected_application_cannot_use_seller_operations(): void
    {
        $application = $this->submitApplication($this->customer());
        $superAdmin = $this->superAdmin();
        Sanctum::actingAs($superAdmin);

        $this->postJson('/api/v1/admin/marketplace/applications/'.$application->id.'/reject', ['rejection_reason' => 'Please provide a valid business license.'])
            ->assertOk()
            ->assertJsonPath('data.application_status', SellerApplication::STATUS_REJECTED);

        Sanctum::actingAs($application->user);
        $this->getJson('/api/v1/seller/dashboard')->assertForbidden();
        $this->assertDatabaseHas('seller_approval_history', ['seller_application_id' => $application->id, 'action' => 'rejected', 'to_status' => SellerApplication::STATUS_REJECTED]);
    }

    public function test_suspending_an_approved_seller_immediately_revokes_access(): void
    {
        $owner = $this->customer();
        $application = $this->submitApplication($owner);
        $superAdmin = $this->superAdmin();
        Sanctum::actingAs($superAdmin);
        $seller = $this->postJson('/api/v1/admin/marketplace/applications/'.$application->id.'/approve', ['store_name' => 'Suspendable Shop', 'slug' => 'suspendable-shop'])->assertOk()->json('data');
        $sellerModel = Seller::query()->findOrFail($seller['id']);

        $this->patchJson('/api/v1/admin/marketplace/sellers/'.$sellerModel->id.'/status', ['status' => Seller::STATUS_SUSPENDED, 'reason' => 'Verification expired.'])
            ->assertOk()
            ->assertJsonPath('data.status', Seller::STATUS_SUSPENDED);

        Sanctum::actingAs($owner);
        $this->getJson('/api/v1/seller/dashboard')->assertForbidden();
        $this->assertDatabaseHas('seller_memberships', ['seller_id' => $sellerModel->id, 'user_id' => $owner->id, 'status' => 'suspended']);
        $this->assertDatabaseHas('seller_applications', ['id' => $application->id, 'application_status' => SellerApplication::STATUS_SUSPENDED]);
        $this->assertDatabaseHas('audit_logs', ['action' => 'seller.suspended', 'resource_type' => Seller::class]);
    }

    public function test_approved_seller_is_isolated_from_another_sellers_products_and_orders(): void
    {
        [$ownerA, $sellerA, $productA] = $this->approvedSeller('store-a');
        [, $sellerB, $productB] = $this->approvedSeller('store-b');
        SellerOrder::query()->create([
            'order_id' => $this->orderFor($ownerA)->id,
            'seller_id' => $sellerB->id,
            'order_number' => 'ORD-STORE-B',
            'status' => 'pending',
            'payment_status' => 'paid',
            'fulfillment_status' => 'pending',
            'subtotal_minor' => 1000,
            'shipping_minor' => 0,
            'commission_minor' => 100,
            'net_minor' => 900,
            'currency' => 'MMK',
        ]);
        Sanctum::actingAs($ownerA);

        $this->getJson('/api/v1/seller/products')->assertOk()->assertJsonPath('meta.total', 1)->assertJsonPath('data.0.id', $productA->id);
        $this->patchJson('/api/v1/seller/products/'.$productB->id, ['name' => 'Cross-store mutation'])->assertNotFound();
        $this->getJson('/api/v1/seller/orders')->assertOk()->assertJsonPath('meta.total', 0);
        $this->assertDatabaseHas('products', ['id' => $productB->id, 'name' => $productB->name]);
    }

    private function customer(): User
    {
        $user = User::factory()->create();
        $user->roles()->attach(Role::query()->firstOrCreate(['name' => 'customer'], ['label' => 'Customer']));

        return $user;
    }

    private function superAdmin(): User
    {
        $user = User::factory()->create();
        $role = Role::query()->firstOrCreate(['name' => 'super_admin'], ['label' => 'Super Administrator']);
        $user->roles()->attach($role);

        return $user;
    }

    private function submitApplication(User $user): SellerApplication
    {
        Sanctum::actingAs($user);
        $id = $this->postJson('/api/v1/seller/applications', ['business_name' => 'Applicant Shop', 'business_type' => 'Retail', 'business_details' => ['registration_number' => 'REG-002'], 'contact_details' => ['email' => 'applicant@example.com']])->assertCreated()->json('data.id');

        return SellerApplication::query()->findOrFail($id);
    }

    private function approvedSeller(string $slug): array
    {
        $owner = $this->customer();
        $application = $this->submitApplication($owner);
        $admin = $this->superAdmin();
        Sanctum::actingAs($admin);
        $seller = Seller::query()->findOrFail($this->postJson('/api/v1/admin/marketplace/applications/'.$application->id.'/approve', ['store_name' => ucfirst($slug), 'slug' => $slug])->assertOk()->json('data.id'));
        $category = Category::query()->create(['name' => $slug, 'slug' => $slug]);
        $product = Product::query()->create(['seller_id' => $seller->id, 'category_id' => $category->id, 'name' => 'Product '.$slug, 'slug' => $slug.'-product', 'status' => 'published']);

        return [$owner, $seller, $product];
    }

    private function orderFor(User $user): Order
    {
        return $user->orders()->create(['order_number' => 'ORD-'.strtoupper(fake()->unique()->bothify('????##')), 'shipping_address' => ['city' => 'Yangon'], 'subtotal_minor' => 1000, 'discount_minor' => 0, 'shipping_minor' => 0, 'tax_minor' => 0, 'grand_total_minor' => 1000, 'currency' => 'MMK']);
    }
}
