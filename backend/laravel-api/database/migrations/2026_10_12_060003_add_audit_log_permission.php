<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Support\Facades\DB;

return new class extends Migration
{
    public function up(): void
    {
        DB::table('permissions')->insertOrIgnore([
            'name' => 'view_audit_logs',
            'label' => 'View Audit Logs',
            'created_at' => now(),
            'updated_at' => now(),
        ]);

        $permissionId = DB::table('permissions')->where('name', 'view_audit_logs')->value('id');
        $roleIds = DB::table('roles')->whereIn('name', ['admin', 'super_admin'])->pluck('id');
        foreach ($roleIds as $roleId) {
            DB::table('permission_role')->insertOrIgnore([
                'permission_id' => $permissionId,
                'role_id' => $roleId,
            ]);
        }
    }

    public function down(): void
    {
        $permissionId = DB::table('permissions')->where('name', 'view_audit_logs')->value('id');
        if ($permissionId) {
            DB::table('permission_role')->where('permission_id', $permissionId)->delete();
            DB::table('permissions')->where('id', $permissionId)->delete();
        }
    }
};
