<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('marketplace_settings', function (Blueprint $table): void {
            $table->id();
            $table->string('name')->unique();
            $table->json('value');
            $table->foreignId('updated_by')->nullable()->constrained('users')->nullOnDelete();
            $table->timestamps();
        });

        DB::table('marketplace_settings')->insert([
            'name' => 'commission',
            'value' => json_encode([
                'enabled' => true,
                'default_percentage_bps' => 500,
            ], JSON_THROW_ON_ERROR),
            'created_at' => now(),
            'updated_at' => now(),
        ]);

        Schema::table('commission_rules', function (Blueprint $table): void {
            $table->foreignId('brand_id')->nullable()->after('seller_id')->constrained('brands')->nullOnDelete();
            $table->index(['seller_id', 'brand_id', 'is_active']);
        });

        Schema::table('order_commissions', function (Blueprint $table): void {
            $table->foreignId('seller_id')->nullable()->after('seller_order_id')->constrained('sellers')->nullOnDelete();
            $table->foreignId('brand_id')->nullable()->after('seller_id')->constrained('brands')->nullOnDelete();
            $table->string('rule_source')->default('legacy')->after('commission_rule_id');
            $table->string('status')->default('legacy')->after('rule_source');
            $table->timestamp('confirmed_at')->nullable()->after('status');
            $table->index(['seller_id', 'brand_id', 'status']);
        });

        Schema::create('commission_adjustments', function (Blueprint $table): void {
            $table->id();
            $table->foreignId('order_commission_id')->constrained('order_commissions')->restrictOnDelete();
            $table->foreignId('seller_order_id')->constrained('seller_orders')->cascadeOnDelete();
            $table->foreignId('seller_order_item_id')->nullable()->constrained('seller_order_items')->nullOnDelete();
            $table->foreignId('refund_id')->nullable()->constrained('refunds')->nullOnDelete();
            $table->string('type')->default('reversal');
            $table->unsignedBigInteger('amount_minor');
            $table->string('currency', 3);
            $table->string('idempotency_key')->unique();
            $table->foreignId('created_by')->nullable()->constrained('users')->nullOnDelete();
            $table->json('metadata')->nullable();
            $table->timestamps();
            $table->index(['seller_order_id', 'type']);
            $table->index(['refund_id', 'type']);
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('commission_adjustments');

        Schema::table('order_commissions', function (Blueprint $table): void {
            $table->dropForeign(['seller_id']);
            $table->dropForeign(['brand_id']);
            $table->dropIndex(['seller_id', 'brand_id', 'status']);
            $table->dropColumn(['seller_id', 'brand_id', 'rule_source', 'status', 'confirmed_at']);
        });

        Schema::table('commission_rules', function (Blueprint $table): void {
            $table->dropForeign(['brand_id']);
            $table->dropIndex(['seller_id', 'brand_id', 'is_active']);
            $table->dropColumn('brand_id');
        });

        Schema::dropIfExists('marketplace_settings');
    }
};
