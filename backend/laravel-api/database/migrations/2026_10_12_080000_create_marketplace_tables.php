<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('sellers', function (Blueprint $table) {
            $table->id();
            $table->foreignId('owner_user_id')->constrained('users')->restrictOnDelete();
            $table->string('store_name');
            $table->string('slug')->unique();
            $table->text('description')->nullable();
            $table->string('logo_path')->nullable();
            $table->string('banner_path')->nullable();
            $table->string('support_email')->nullable();
            $table->string('support_phone', 30)->nullable();
            $table->string('status', 30)->default('pending')->index();
            $table->string('payout_provider')->nullable();
            $table->string('payout_provider_account_id')->nullable();
            $table->timestamp('approved_at')->nullable();
            $table->foreignId('approved_by')->nullable()->constrained('users')->nullOnDelete();
            $table->timestamp('suspended_at')->nullable();
            $table->timestamps();
        });

        Schema::create('seller_memberships', function (Blueprint $table) {
            $table->id();
            $table->foreignId('seller_id')->constrained()->cascadeOnDelete();
            $table->foreignId('user_id')->constrained()->cascadeOnDelete();
            $table->string('role', 30)->default('owner');
            $table->string('status', 30)->default('active');
            $table->timestamps();
            $table->unique(['seller_id', 'user_id']);
            $table->index(['user_id', 'status']);
        });

        Schema::create('seller_applications', function (Blueprint $table) {
            $table->id();
            $table->foreignId('user_id')->constrained()->cascadeOnDelete();
            $table->string('business_name');
            $table->string('business_type')->nullable();
            $table->json('contact_details')->nullable();
            $table->string('application_status', 30)->default('draft')->index();
            $table->timestamp('submitted_at')->nullable();
            $table->timestamp('reviewed_at')->nullable();
            $table->foreignId('reviewed_by')->nullable()->constrained('users')->nullOnDelete();
            $table->text('rejection_reason')->nullable();
            $table->timestamps();
            $table->index(['user_id', 'application_status']);
        });

        Schema::create('seller_documents', function (Blueprint $table) {
            $table->id();
            $table->foreignId('seller_application_id')->constrained()->cascadeOnDelete();
            $table->string('document_type', 50);
            $table->string('storage_path');
            $table->string('status', 30)->default('pending');
            $table->timestamp('retention_until')->nullable();
            $table->foreignId('verified_by')->nullable()->constrained('users')->nullOnDelete();
            $table->timestamps();
            $table->index(['seller_application_id', 'status']);
        });

        Schema::create('seller_settings', function (Blueprint $table) {
            $table->id();
            $table->foreignId('seller_id')->unique()->constrained()->cascadeOnDelete();
            $table->json('store_policies')->nullable();
            $table->json('shipping_configuration')->nullable();
            $table->json('notification_preferences')->nullable();
            $table->json('operational_settings')->nullable();
            $table->timestamps();
        });

        Schema::table('products', function (Blueprint $table) {
            $table->foreign('seller_id')->references('id')->on('sellers')->nullOnDelete();
        });

        Schema::table('order_items', function (Blueprint $table) {
            $table->unsignedBigInteger('seller_id')->nullable()->index();
        });

        Schema::create('seller_orders', function (Blueprint $table) {
            $table->id();
            $table->foreignId('order_id')->constrained()->cascadeOnDelete();
            $table->foreignId('seller_id')->constrained()->restrictOnDelete();
            $table->string('order_number')->unique();
            $table->string('status', 30)->default('pending')->index();
            $table->string('payment_status', 30)->default('pending')->index();
            $table->string('fulfillment_status', 30)->default('pending')->index();
            $table->unsignedBigInteger('subtotal_minor');
            $table->unsignedBigInteger('shipping_minor')->default(0);
            $table->unsignedBigInteger('commission_minor')->default(0);
            $table->unsignedBigInteger('net_minor')->default(0);
            $table->string('currency', 3)->default('MMK');
            $table->timestamps();
            $table->unique(['order_id', 'seller_id']);
        });

        Schema::create('seller_order_items', function (Blueprint $table) {
            $table->id();
            $table->foreignId('seller_order_id')->constrained()->cascadeOnDelete();
            $table->foreignId('order_item_id')->constrained()->cascadeOnDelete();
            $table->foreignId('product_variant_id')->nullable()->constrained()->nullOnDelete();
            $table->string('product_name');
            $table->string('sku');
            $table->unsignedInteger('quantity');
            $table->unsignedBigInteger('unit_price_minor');
            $table->unsignedBigInteger('line_total_minor');
            $table->timestamps();
            $table->unique('order_item_id');
        });

        Schema::create('seller_order_status_history', function (Blueprint $table) {
            $table->id();
            $table->foreignId('seller_order_id')->constrained()->cascadeOnDelete();
            $table->string('from_status', 30)->nullable();
            $table->string('to_status', 30);
            $table->foreignId('changed_by')->nullable()->constrained('users')->nullOnDelete();
            $table->text('note')->nullable();
            $table->timestamps();
        });

        Schema::create('commission_rules', function (Blueprint $table) {
            $table->id();
            $table->foreignId('seller_id')->nullable()->constrained()->cascadeOnDelete();
            $table->foreignId('category_id')->nullable()->constrained()->nullOnDelete();
            $table->unsignedInteger('percentage_bps')->default(1000);
            $table->unsignedBigInteger('fixed_minor')->default(0);
            $table->string('currency', 3)->default('MMK');
            $table->timestamp('starts_at')->nullable();
            $table->timestamp('ends_at')->nullable();
            $table->boolean('is_active')->default(true)->index();
            $table->timestamps();
            $table->index(['seller_id', 'is_active']);
        });

        Schema::create('order_commissions', function (Blueprint $table) {
            $table->id();
            $table->foreignId('seller_order_id')->constrained()->cascadeOnDelete();
            $table->foreignId('seller_order_item_id')->nullable()->constrained()->nullOnDelete();
            $table->foreignId('commission_rule_id')->nullable()->constrained()->nullOnDelete();
            $table->unsignedInteger('percentage_bps');
            $table->unsignedBigInteger('fixed_minor')->default(0);
            $table->unsignedBigInteger('gross_minor');
            $table->unsignedBigInteger('commission_minor');
            $table->unsignedBigInteger('net_minor');
            $table->string('currency', 3)->default('MMK');
            $table->json('snapshot')->nullable();
            $table->timestamps();
            $table->unique('seller_order_item_id');
        });

        Schema::create('seller_ledger_entries', function (Blueprint $table) {
            $table->id();
            $table->foreignId('seller_id')->constrained()->cascadeOnDelete();
            $table->foreignId('seller_order_id')->nullable()->constrained()->nullOnDelete();
            // Payouts are created after ledger entries; keep this nullable link additive.
            $table->unsignedBigInteger('payout_id')->nullable()->index();
            $table->string('type', 40);
            $table->bigInteger('amount_minor');
            $table->string('currency', 3)->default('MMK');
            $table->string('reference_type')->nullable();
            $table->unsignedBigInteger('reference_id')->nullable();
            $table->string('idempotency_key')->unique();
            $table->json('metadata')->nullable();
            $table->timestamp('occurred_at');
            $table->timestamps();
            $table->index(['seller_id', 'occurred_at']);
        });

        Schema::create('seller_payouts', function (Blueprint $table) {
            $table->id();
            $table->foreignId('seller_id')->constrained()->cascadeOnDelete();
            $table->string('status', 30)->default('pending')->index();
            $table->unsignedBigInteger('amount_minor');
            $table->string('currency', 3)->default('MMK');
            $table->string('provider')->nullable();
            $table->string('provider_payout_id')->nullable();
            $table->string('idempotency_key')->unique();
            $table->text('failure_message')->nullable();
            $table->timestamp('requested_at')->nullable();
            $table->timestamp('processed_at')->nullable();
            $table->timestamps();
        });

        Schema::create('seller_payout_items', function (Blueprint $table) {
            $table->id();
            $table->foreignId('seller_payout_id')->constrained()->cascadeOnDelete();
            $table->foreignId('ledger_entry_id')->constrained('seller_ledger_entries')->restrictOnDelete();
            $table->unsignedBigInteger('amount_minor');
            $table->timestamps();
            $table->unique(['seller_payout_id', 'ledger_entry_id']);
        });

        Schema::create('seller_refund_allocations', function (Blueprint $table) {
            $table->id();
            $table->foreignId('refund_id')->constrained()->cascadeOnDelete();
            $table->foreignId('seller_order_id')->constrained()->cascadeOnDelete();
            $table->foreignId('seller_order_item_id')->nullable()->constrained()->nullOnDelete();
            $table->unsignedBigInteger('amount_minor');
            $table->unsignedBigInteger('commission_reversed_minor')->default(0);
            $table->string('ledger_idempotency_key')->unique();
            $table->timestamps();
        });

        Schema::create('payout_reconciliation_records', function (Blueprint $table) {
            $table->id();
            $table->foreignId('seller_payout_id')->nullable()->constrained()->nullOnDelete();
            $table->string('provider_reference')->nullable()->index();
            $table->string('status', 30)->default('pending');
            $table->unsignedBigInteger('expected_minor')->default(0);
            $table->unsignedBigInteger('actual_minor')->default(0);
            $table->bigInteger('difference_minor')->default(0);
            $table->json('metadata')->nullable();
            $table->timestamp('reconciled_at')->nullable();
            $table->timestamps();
        });

        Schema::table('shipments', function (Blueprint $table) {
            $table->foreignId('seller_order_id')->nullable()->constrained()->nullOnDelete();
        });

        $permissionId = DB::table('permissions')->where('name', 'manage_marketplace')->value('id');
        if (! $permissionId) {
            $permissionId = DB::table('permissions')->insertGetId([
                'name' => 'manage_marketplace', 'label' => 'Manage marketplace',
                'created_at' => now(), 'updated_at' => now(),
            ]);
        }
        $roleIds = DB::table('roles')->whereIn('name', ['admin', 'super_admin'])->pluck('id');
        foreach ($roleIds as $roleId) {
            DB::table('permission_role')->updateOrInsert(['permission_id' => $permissionId, 'role_id' => $roleId]);
        }
    }

    public function down(): void
    {
        Schema::table('shipments', fn (Blueprint $table) => $table->dropForeign(['seller_order_id']));
        Schema::table('shipments', fn (Blueprint $table) => $table->dropColumn('seller_order_id'));
        Schema::dropIfExists('payout_reconciliation_records');
        Schema::dropIfExists('seller_refund_allocations');
        Schema::dropIfExists('seller_payout_items');
        Schema::dropIfExists('seller_payouts');
        Schema::dropIfExists('seller_ledger_entries');
        Schema::dropIfExists('order_commissions');
        Schema::dropIfExists('commission_rules');
        Schema::dropIfExists('seller_order_status_history');
        Schema::dropIfExists('seller_order_items');
        Schema::dropIfExists('seller_orders');
        Schema::table('order_items', fn (Blueprint $table) => $table->dropColumn('seller_id'));
        Schema::table('products', fn (Blueprint $table) => $table->dropForeign(['seller_id']));
        Schema::dropIfExists('seller_settings');
        Schema::dropIfExists('seller_documents');
        Schema::dropIfExists('seller_applications');
        Schema::dropIfExists('seller_memberships');
        Schema::dropIfExists('sellers');
    }
};
