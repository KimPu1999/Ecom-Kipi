<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('shipping_methods', function (Blueprint $table) {
            $table->id();
            $table->string('code')->unique();
            $table->string('name');
            $table->text('description')->nullable();
            $table->unsignedBigInteger('price_minor')->default(0);
            $table->string('currency', 3)->default('MMK');
            $table->boolean('is_active')->default(true)->index();
            $table->unsignedInteger('sort_order')->default(0);
            $table->timestamps();
        });

        Schema::table('orders', function (Blueprint $table) {
            $table->foreignId('shipping_method_id')->nullable()->after('billing_address')->constrained('shipping_methods')->nullOnDelete();
        });

        Schema::create('payments', function (Blueprint $table) {
            $table->id();
            $table->foreignId('order_id')->constrained()->restrictOnDelete();
            $table->string('provider', 40);
            $table->string('provider_payment_id')->nullable()->index();
            $table->string('status', 30)->index();
            $table->unsignedBigInteger('amount_minor');
            $table->string('currency', 3);
            $table->string('failure_code')->nullable();
            $table->text('failure_message')->nullable();
            $table->json('metadata')->nullable();
            $table->timestamp('paid_at')->nullable();
            $table->timestamps();
            $table->index(['order_id', 'status']);
        });

        Schema::create('payment_attempts', function (Blueprint $table) {
            $table->id();
            $table->foreignId('payment_id')->constrained()->cascadeOnDelete();
            $table->unsignedInteger('attempt_number');
            $table->string('idempotency_key', 120);
            $table->string('status', 30)->index();
            $table->string('provider_payment_id')->nullable();
            $table->string('provider_request_id')->nullable();
            $table->string('failure_code')->nullable();
            $table->text('failure_message')->nullable();
            $table->timestamps();
            $table->unique(['payment_id', 'idempotency_key']);
        });

        Schema::create('payment_events', function (Blueprint $table) {
            $table->id();
            $table->foreignId('payment_id')->nullable()->constrained()->nullOnDelete();
            $table->string('provider', 40);
            $table->string('provider_event_id', 255)->unique();
            $table->string('event_type', 100);
            $table->json('payload');
            $table->timestamp('processed_at')->nullable();
            $table->text('processing_error')->nullable();
            $table->timestamps();
        });

        Schema::create('payment_webhook_events', function (Blueprint $table) {
            $table->id();
            $table->string('provider', 40);
            $table->string('provider_event_id', 255)->unique();
            $table->string('status', 30)->default('received')->index();
            $table->json('payload');
            $table->text('error')->nullable();
            $table->timestamp('processed_at')->nullable();
            $table->timestamps();
        });

        Schema::create('inventory_reservations', function (Blueprint $table) {
            $table->id();
            $table->foreignId('order_id')->constrained()->cascadeOnDelete();
            $table->foreignId('product_variant_id')->constrained()->restrictOnDelete();
            $table->foreignId('inventory_id')->constrained()->restrictOnDelete();
            $table->unsignedInteger('quantity');
            $table->string('status', 20)->default('active')->index();
            $table->timestamp('expires_at')->nullable()->index();
            $table->timestamp('committed_at')->nullable();
            $table->timestamp('released_at')->nullable();
            $table->timestamps();
            $table->unique(['order_id', 'product_variant_id']);
        });

        Schema::create('shipments', function (Blueprint $table) {
            $table->id();
            $table->foreignId('order_id')->constrained()->restrictOnDelete();
            $table->foreignId('shipping_method_id')->nullable()->constrained()->nullOnDelete();
            $table->string('status', 30)->default('pending')->index();
            $table->string('carrier')->nullable();
            $table->string('tracking_number')->nullable()->index();
            $table->timestamp('shipped_at')->nullable();
            $table->timestamp('delivered_at')->nullable();
            $table->json('metadata')->nullable();
            $table->timestamps();
        });

        Schema::create('shipment_items', function (Blueprint $table) {
            $table->id();
            $table->foreignId('shipment_id')->constrained()->cascadeOnDelete();
            $table->foreignId('order_item_id')->constrained()->restrictOnDelete();
            $table->unsignedInteger('quantity');
            $table->timestamps();
            $table->unique(['shipment_id', 'order_item_id']);
        });

        Schema::create('shipment_tracking', function (Blueprint $table) {
            $table->id();
            $table->foreignId('shipment_id')->constrained()->cascadeOnDelete();
            $table->string('status', 30);
            $table->string('location')->nullable();
            $table->text('message')->nullable();
            $table->timestamp('occurred_at');
            $table->timestamps();
        });

        Schema::create('refunds', function (Blueprint $table) {
            $table->id();
            $table->foreignId('order_id')->constrained()->restrictOnDelete();
            $table->foreignId('payment_id')->nullable()->constrained()->nullOnDelete();
            $table->foreignId('requested_by')->nullable()->constrained('users')->nullOnDelete();
            $table->string('provider_ref')->nullable()->unique();
            $table->string('status', 30)->default('requested')->index();
            $table->unsignedBigInteger('amount_minor');
            $table->string('currency', 3);
            $table->string('reason')->nullable();
            $table->json('metadata')->nullable();
            $table->timestamp('processed_at')->nullable();
            $table->timestamps();
        });

        Schema::create('refund_items', function (Blueprint $table) {
            $table->id();
            $table->foreignId('refund_id')->constrained()->cascadeOnDelete();
            $table->foreignId('order_item_id')->constrained()->restrictOnDelete();
            $table->unsignedInteger('quantity');
            $table->unsignedBigInteger('amount_minor');
            $table->timestamps();
        });

        Schema::create('idempotency_keys', function (Blueprint $table) {
            $table->id();
            $table->foreignId('user_id')->nullable()->constrained()->nullOnDelete();
            $table->string('operation', 80);
            $table->string('key', 120);
            $table->string('request_hash', 64);
            $table->unsignedSmallInteger('response_code')->nullable();
            $table->json('response_payload')->nullable();
            $table->string('status', 20)->default('processing')->index();
            $table->timestamp('expires_at')->index();
            $table->timestamps();
            $table->unique(['user_id', 'operation', 'key']);
        });

        DB::table('shipping_methods')->insert([
            'code' => 'standard',
            'name' => 'Standard delivery',
            'description' => 'Manual delivery coordination for the initial release.',
            'price_minor' => 0,
            'currency' => 'MMK',
            'is_active' => true,
            'sort_order' => 1,
            'created_at' => now(),
            'updated_at' => now(),
        ]);
    }

    public function down(): void
    {
        Schema::table('orders', function (Blueprint $table) {
            $table->dropConstrainedForeignId('shipping_method_id');
        });
        Schema::dropIfExists('idempotency_keys');
        Schema::dropIfExists('refund_items');
        Schema::dropIfExists('refunds');
        Schema::dropIfExists('shipment_tracking');
        Schema::dropIfExists('shipment_items');
        Schema::dropIfExists('shipments');
        Schema::dropIfExists('inventory_reservations');
        Schema::dropIfExists('payment_webhook_events');
        Schema::dropIfExists('payment_events');
        Schema::dropIfExists('payment_attempts');
        Schema::dropIfExists('payments');
        Schema::dropIfExists('shipping_methods');
    }
};
