<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        if (! Schema::hasTable('seller_payout_methods')) {
            Schema::create('seller_payout_methods', function (Blueprint $table): void {
                $table->id();
                $table->foreignId('seller_id')->constrained()->cascadeOnDelete();
                $table->string('method', 40);
                $table->string('provider_name', 120)->nullable();
                $table->string('account_holder_name', 150);
                // This value is encrypted by the Eloquent model and must never
                // be returned directly by the API.
                $table->longText('account_identifier');
                $table->string('account_last4', 4)->nullable();
                $table->string('verification_status', 30)->default('unverified')->index();
                $table->timestamp('verified_at')->nullable();
                $table->foreignId('verified_by')->nullable()->constrained('users')->nullOnDelete();
                $table->boolean('is_default')->default(false)->index();
                $table->boolean('is_active')->default(true)->index();
                $table->timestamps();
                $table->index(['seller_id', 'is_active']);
            });
        }

        if (Schema::hasTable('seller_payouts') && ! Schema::hasColumn('seller_payouts', 'payout_method_id')) {
            Schema::table('seller_payouts', function (Blueprint $table): void {
                $table->foreignId('payout_method_id')->nullable()->after('seller_id')->constrained('seller_payout_methods')->nullOnDelete();
            });
        }

        if (! Schema::hasTable('seller_payout_status_history')) {
            Schema::create('seller_payout_status_history', function (Blueprint $table): void {
                $table->id();
                $table->foreignId('seller_payout_id')->constrained('seller_payouts')->cascadeOnDelete();
                $table->foreignId('actor_id')->nullable()->constrained('users')->nullOnDelete();
                $table->string('from_status', 30)->nullable();
                $table->string('to_status', 30);
                $table->text('note')->nullable();
                $table->string('provider_reference')->nullable();
                $table->timestamps();
                $table->index(['seller_payout_id', 'created_at']);
            });
        }
    }

    public function down(): void
    {
        Schema::dropIfExists('seller_payout_status_history');

        if (Schema::hasTable('seller_payouts') && Schema::hasColumn('seller_payouts', 'payout_method_id')) {
            Schema::table('seller_payouts', function (Blueprint $table): void {
                $table->dropForeign(['payout_method_id']);
                $table->dropColumn('payout_method_id');
            });
        }

        Schema::dropIfExists('seller_payout_methods');
    }
};
