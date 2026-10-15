<?php

namespace Database\Seeders;

use App\Models\Brand;
use App\Models\Category;
use App\Models\Permission;
use App\Models\Product;
use App\Models\Role;
use App\Models\User;
use Illuminate\Database\Seeder;
use Illuminate\Support\Facades\Hash;

class DatabaseSeeder extends Seeder
{
    public function run(): void
    {
        $roles = collect([
            ['name' => 'super_admin', 'label' => 'Super Administrator'],
            ['name' => 'admin', 'label' => 'Administrator'],
            ['name' => 'store_admin', 'label' => 'Store Admin'],
            ['name' => 'staff', 'label' => 'Staff'],
            ['name' => 'customer', 'label' => 'Customer'],
            ['name' => 'seller', 'label' => 'Seller'],
        ])->mapWithKeys(fn (array $role) => [$role['name'] => Role::query()->firstOrCreate(['name' => $role['name']], $role)]);

        $permissions = collect();
        foreach (['manage_users', 'manage_catalog', 'manage_inventory', 'manage_orders', 'view_audit_logs', 'manage_marketplace'] as $name) {
            $permissions->put($name, Permission::query()->firstOrCreate(
                ['name' => $name],
                ['label' => ucwords(str_replace('_', ' ', $name))]
            ));
        }
        $roles['super_admin']->permissions()->sync($permissions->values());
        $roles['admin']->permissions()->sync($permissions->values());

        $admin = User::query()->firstOrCreate(
            ['email' => env('SEED_ADMIN_EMAIL', 'admin@example.com')],
            ['name' => 'Platform Admin', 'password' => Hash::make(env('SEED_ADMIN_PASSWORD', 'ChangeMe123!')), 'status' => 'active']
        );
        $admin->roles()->syncWithoutDetaching([$roles['super_admin']->id]);

        $customer = User::query()->firstOrCreate(
            ['email' => 'customer@example.com'],
            ['name' => 'Demo Customer', 'password' => Hash::make('ChangeMe123!'), 'status' => 'active']
        );
        $customer->roles()->syncWithoutDetaching([$roles['customer']->id]);

        $category = Category::query()->firstOrCreate(['slug' => 'general'], ['name' => 'General', 'is_active' => true]);
        $brand = Brand::query()->firstOrCreate(['slug' => 'kipi'], ['name' => 'Kipi', 'is_active' => true]);
        $product = Product::query()->firstOrCreate(
            ['slug' => 'demo-product'],
            ['category_id' => $category->id, 'brand_id' => $brand->id, 'name' => 'Demo Product', 'description' => 'Seed product', 'status' => 'published']
        );
        $variant = $product->variants()->firstOrCreate(
            ['sku' => 'DEMO-001'],
            ['price_minor' => 10000, 'currency' => 'MMK', 'is_active' => true]
        );
        $variant->inventory()->firstOrCreate([], ['quantity' => 100, 'low_stock_threshold' => 5]);
    }
}
