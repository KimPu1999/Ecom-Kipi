<?php

namespace Tests\Feature\Api;

use App\Models\Permission;
use App\Models\Role;
use App\Models\Seller;
use App\Models\SellerLedgerEntry;
use App\Models\SellerPayout;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Laravel\Sanctum\Sanctum;
use Tests\TestCase;

class SellerPayoutTest extends TestCase
{
    use RefreshDatabase;

    public function test_seller_payout_methods_and_requests_are_isolated_and_idempotent(): void
    {
        [$seller, $owner] = $this->seller('seller-payout-a');
        [, $otherOwner] = $this->seller('seller-payout-b');
        SellerLedgerEntry::query()->create([
            'seller_id' => $seller->id,
            'type' => 'sale_credit',
            'amount_minor' => 1000,
            'currency' => 'MMK',
            'idempotency_key' => 'test-sale-a',
            'occurred_at' => now(),
        ]);

        Sanctum::actingAs($owner);
        $method = $this->postJson('/api/v1/seller/payout-methods', [
            'method' => 'kbzpay',
            'provider_name' => 'KBZPay',
            'account_holder_name' => 'Seller A',
            'account_identifier' => '09790000123',
            'is_default' => true,
        ])->assertCreated()->assertJsonPath('data.verification_status', 'unverified')->assertJsonMissingPath('data.account_identifier')->json('data');

        $headers = ['Idempotency-Key' => 'seller-a-payout-1'];
        $first = $this->withHeaders($headers)->postJson('/api/v1/seller/payouts', ['amount_minor' => 500, 'payout_method_id' => $method['id']])->assertCreated()->json('data');
        $this->withHeaders($headers)->postJson('/api/v1/seller/payouts', ['amount_minor' => 500, 'payout_method_id' => $method['id']])->assertOk()->assertJsonPath('data.id', $first['id']);
        $this->withHeaders(['Idempotency-Key' => 'seller-a-payout-2'])->postJson('/api/v1/seller/payouts', ['amount_minor' => 600, 'payout_method_id' => $method['id']])->assertUnprocessable()->assertJsonValidationErrors(['amount_minor']);
        $this->assertDatabaseCount('seller_payouts', 1);

        Sanctum::actingAs($otherOwner);
        $this->patchJson('/api/v1/seller/payout-methods/'.$method['id'], ['account_holder_name' => 'Cross seller'])->assertNotFound();
        $this->assertDatabaseHas('seller_payout_methods', ['id' => $method['id'], 'seller_id' => $seller->id]);
    }

    public function test_seller_cannot_request_more_than_the_available_balance(): void
    {
        [$seller, $owner] = $this->seller('seller-payout-balance');
        SellerLedgerEntry::query()->create([
            'seller_id' => $seller->id,
            'type' => 'sale_credit',
            'amount_minor' => 100,
            'currency' => 'MMK',
            'idempotency_key' => 'test-sale-balance',
            'occurred_at' => now(),
        ]);
        Sanctum::actingAs($owner);
        $method = $this->postJson('/api/v1/seller/payout-methods', [
            'method' => 'wavepay',
            'account_holder_name' => 'Balance Seller',
            'account_identifier' => '09990000444',
        ])->assertCreated()->json('data');

        $this->withHeaders(['Idempotency-Key' => 'balance-too-high'])->postJson('/api/v1/seller/payouts', [
            'amount_minor' => 101,
            'payout_method_id' => $method['id'],
        ])->assertUnprocessable()->assertJsonValidationErrors(['amount_minor']);
    }

    public function test_only_authorized_admins_can_advance_payouts_and_paid_requires_reference(): void
    {
        [$seller, $owner] = $this->seller('seller-payout-admin');
        SellerLedgerEntry::query()->create([
            'seller_id' => $seller->id,
            'type' => 'sale_credit',
            'amount_minor' => 500,
            'currency' => 'MMK',
            'idempotency_key' => 'test-sale-admin',
            'occurred_at' => now(),
        ]);
        Sanctum::actingAs($owner);
        $method = $this->postJson('/api/v1/seller/payout-methods', [
            'method' => 'bank_transfer',
            'provider_name' => 'Example Bank',
            'account_holder_name' => 'Admin Test Seller',
            'account_identifier' => '1234567890',
        ])->assertCreated()->json('data');
        $payout = $this->withHeaders(['Idempotency-Key' => 'admin-payout-1'])->postJson('/api/v1/seller/payouts', ['amount_minor' => 500, 'payout_method_id' => $method['id']])->assertCreated()->json('data');

        $customer = User::factory()->create();
        Sanctum::actingAs($customer);
        $this->patchJson('/api/v1/admin/marketplace/payouts/'.$payout['id'].'/status', ['status' => 'approved'])->assertForbidden();

        $admin = User::factory()->create();
        $role = Role::query()->create(['name' => 'super_admin', 'label' => 'Super Administrator']);
        $role->permissions()->attach(Permission::query()->firstOrCreate(['name' => 'manage_marketplace'], ['label' => 'Manage marketplace']));
        $admin->roles()->attach($role);
        Sanctum::actingAs($admin);
        $this->patchJson('/api/v1/admin/marketplace/payouts/'.$payout['id'].'/status', ['status' => 'approved'])->assertOk();
        $this->patchJson('/api/v1/admin/marketplace/payouts/'.$payout['id'].'/status', ['status' => 'processing'])->assertOk();
        $this->patchJson('/api/v1/admin/marketplace/payouts/'.$payout['id'].'/status', ['status' => 'paid'])->assertUnprocessable()->assertJsonValidationErrors(['provider_reference']);
        $this->patchJson('/api/v1/admin/marketplace/payouts/'.$payout['id'].'/status', ['status' => 'paid', 'provider_reference' => 'MANUAL-PAID-1'])->assertOk()->assertJsonPath('data.status', 'paid');
        $this->assertDatabaseHas('seller_payout_status_history', ['seller_payout_id' => $payout['id'], 'to_status' => 'paid', 'provider_reference' => 'MANUAL-PAID-1']);
    }

    private function seller(string $slug): array
    {
        $owner = User::factory()->create();
        $seller = Seller::query()->create([
            'owner_user_id' => $owner->id,
            'store_name' => ucfirst($slug),
            'slug' => $slug,
            'status' => Seller::STATUS_APPROVED,
        ]);
        $seller->memberships()->create(['user_id' => $owner->id, 'role' => 'owner', 'status' => 'active']);

        return [$seller, $owner];
    }
}
