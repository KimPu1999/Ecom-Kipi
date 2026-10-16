<?php

namespace Tests\Feature\Api;

use App\Models\AuditLog;
use App\Models\Role;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Laravel\Sanctum\Sanctum;
use Tests\TestCase;

class AdminPhase5Test extends TestCase
{
    use RefreshDatabase;

    public function test_customer_cannot_access_dashboard_or_audit_logs(): void
    {
        $customer = User::factory()->create();
        $customer->roles()->attach(Role::query()->create(['name' => 'customer', 'label' => 'Customer']));
        Sanctum::actingAs($customer);

        $this->getJson('/api/v1/admin/dashboard')->assertForbidden();
        $this->getJson('/api/v1/admin/audit-logs')->assertForbidden();
    }

    public function test_super_admin_can_read_dashboard_and_create_an_audited_category(): void
    {
        $admin = User::factory()->create();
        $admin->roles()->attach(Role::query()->create(['name' => 'super_admin', 'label' => 'Super Administrator']));
        Sanctum::actingAs($admin);

        $this->getJson('/api/v1/admin/dashboard')
            ->assertOk()
            ->assertJsonStructure(['data' => ['metrics', 'sales_trend', 'status_distribution', 'low_stock']]);

        $this->postJson('/api/v1/admin/categories', [
            'name' => 'Office',
            'slug' => 'office',
            'is_active' => true,
        ])->assertCreated();

        $this->assertDatabaseHas('audit_logs', [
            'actor_user_id' => $admin->id,
            'action' => 'category.created',
            'resource_type' => 'App\\Models\\Category',
        ]);
    }

    public function test_dashboard_sales_trend_supports_ninety_days_and_fills_calendar_days(): void
    {
        $admin = User::factory()->create();
        $admin->roles()->attach(Role::query()->create(['name' => 'super_admin', 'label' => 'Super Administrator']));
        Sanctum::actingAs($admin);

        $this->getJson('/api/v1/admin/dashboard?period=90d')
            ->assertOk()
            ->assertJsonCount(90, 'data.sales_trend')
            ->assertJsonPath('data.sales_trend.0.revenue', 0)
            ->assertJsonPath('data.sales_trend.89.revenue', 0);
    }

    public function test_super_admin_can_search_users_and_view_audit_logs(): void
    {
        $admin = User::factory()->create(['name' => 'Platform Owner']);
        $admin->roles()->attach(Role::query()->create(['name' => 'super_admin', 'label' => 'Super Administrator']));
        Sanctum::actingAs($admin);
        AuditLog::query()->create(['actor_user_id' => $admin->id, 'action' => 'test.activity']);

        $this->getJson('/api/v1/admin/users?q=Platform')
            ->assertOk()
            ->assertJsonPath('data.0.name', 'Platform Owner');
        $this->getJson('/api/v1/admin/audit-logs')
            ->assertOk()
            ->assertJsonPath('data.0.action', 'test.activity');
    }
}
