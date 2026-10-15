<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('shipping_carriers', function (Blueprint $table) {
            $table->id();
            $table->string('name', 120);
            $table->string('code', 60)->unique();
            $table->string('type', 30)->default('external_courier');
            $table->string('tracking_url', 500)->nullable();
            $table->string('tracking_url_template', 500)->nullable();
            $table->string('contact_email', 150)->nullable();
            $table->string('contact_phone', 40)->nullable();
            $table->json('regions')->nullable();
            $table->boolean('is_active')->default(true)->index();
            $table->unsignedInteger('sort_order')->default(0)->index();
            $table->timestamps();
        });

        Schema::create('riders', function (Blueprint $table) {
            $table->id();
            $table->foreignId('user_id')->nullable()->constrained()->nullOnDelete();
            $table->foreignId('seller_id')->nullable()->constrained()->nullOnDelete();
            $table->string('name', 150);
            $table->string('phone', 40)->nullable();
            $table->json('coverage_regions')->nullable();
            $table->string('status', 20)->default('active')->index();
            $table->timestamps();
            $table->index(['seller_id', 'status']);
        });

        Schema::table('shipments', function (Blueprint $table) {
            $table->string('delivery_method', 30)->nullable()->index();
            $table->foreignId('carrier_id')->nullable()->constrained('shipping_carriers')->nullOnDelete();
            $table->string('internal_tracking_id', 40)->nullable()->unique();
            $table->foreignId('rider_id')->nullable()->constrained('riders')->nullOnDelete();
            $table->timestamp('estimated_delivery_at')->nullable();
            $table->text('notes')->nullable();
            $table->foreignId('created_by')->nullable()->constrained('users')->nullOnDelete();
            $table->string('idempotency_key', 120)->nullable()->unique();
        });

        Schema::table('shipment_tracking', function (Blueprint $table) {
            $table->string('previous_status', 30)->nullable();
            $table->foreignId('actor_id')->nullable()->constrained('users')->nullOnDelete();
            $table->string('actor_role', 40)->nullable();
            $table->string('source', 30)->default('manual')->index();
            $table->string('proof_reference', 500)->nullable();
        });
    }

    public function down(): void
    {
        Schema::table('shipment_tracking', function (Blueprint $table) {
            $table->dropForeign(['actor_id']);
            $table->dropColumn(['previous_status', 'actor_id', 'actor_role', 'source', 'proof_reference']);
        });
        Schema::table('shipments', function (Blueprint $table) {
            $table->dropForeign(['carrier_id']);
            $table->dropForeign(['rider_id']);
            $table->dropForeign(['created_by']);
            $table->dropUnique(['internal_tracking_id']);
            $table->dropUnique(['internal_tracking_id']);
            $table->dropUnique(['idempotency_key']);
            $table->dropColumn(['delivery_method', 'carrier_id', 'internal_tracking_id', 'rider_id', 'estimated_delivery_at', 'notes', 'created_by', 'idempotency_key']);
        });
        Schema::dropIfExists('riders');
        Schema::dropIfExists('shipping_carriers');
    }
};
