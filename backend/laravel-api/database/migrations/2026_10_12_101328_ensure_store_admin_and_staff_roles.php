<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Support\Facades\DB;

return new class extends Migration
{
    /**
     * Run the migrations.
     */
    public function up(): void
    {
        DB::table('roles')->insertOrIgnore([
            ['name' => 'store_admin', 'label' => 'Store Admin', 'created_at' => now(), 'updated_at' => now()],
            ['name' => 'staff', 'label' => 'Staff', 'created_at' => now(), 'updated_at' => now()],
        ]);
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        $roleIds = DB::table('roles')->whereIn('name', ['store_admin', 'staff'])->pluck('id');
        DB::table('permission_role')->whereIn('role_id', $roleIds)->delete();
        DB::table('roles')->whereIn('id', $roleIds)->whereNotIn('id', DB::table('role_user')->select('role_id'))->delete();
    }
};
