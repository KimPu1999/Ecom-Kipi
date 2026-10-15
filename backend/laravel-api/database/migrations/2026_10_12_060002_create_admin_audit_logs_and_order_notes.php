<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('audit_logs', function (Blueprint $table) {
            $table->id();
            $table->foreignId('actor_user_id')->nullable()->constrained('users')->nullOnDelete();
            $table->string('action', 100);
            $table->string('resource_type', 100)->nullable();
            $table->unsignedBigInteger('resource_id')->nullable();
            $table->ipAddress('ip_address')->nullable();
            $table->uuid('request_id')->nullable()->index();
            $table->json('before')->nullable();
            $table->json('after')->nullable();
            $table->timestamps();
            $table->index(['resource_type', 'resource_id']);
            $table->index(['actor_user_id', 'created_at']);
        });

        Schema::create('order_notes', function (Blueprint $table) {
            $table->id();
            $table->foreignId('order_id')->constrained()->cascadeOnDelete();
            $table->foreignId('user_id')->nullable()->constrained()->nullOnDelete();
            $table->text('note');
            $table->timestamps();
            $table->index(['order_id', 'created_at']);
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('order_notes');
        Schema::dropIfExists('audit_logs');
    }
};
