# Admin control center

The admin application runs at http://localhost:5174 and uses the same Laravel API as the storefront. It is a single-vendor operations console today, with role and permission boundaries ready for future marketplace expansion.

## Access

Run the backend seeder in a local environment to create the development administrator:

~~~sh
cd backend/laravel-api
php artisan db:seed
~~~

The seeded administrator is admin@example.com with the password configured by SEED_ADMIN_PASSWORD. Change it before sharing an environment.

The browser stores the current bearer session in session storage and sends it through the shared API client. Laravel remains the source of truth: admin middleware checks roles and permission middleware checks manage_users, manage_catalog, manage_inventory, manage_orders, and view_audit_logs.

## Admin API

- GET /api/v1/admin/dashboard?period=30d
- GET/PATCH /api/v1/admin/users
- GET/POST/PUT/DELETE /api/v1/admin/categories
- GET/POST/PUT/DELETE /api/v1/admin/brands
- GET/POST/PUT/DELETE /api/v1/admin/products
- POST /api/v1/admin/products/{id}/variants
- GET /api/v1/admin/inventory
- POST /api/v1/admin/variants/{id}/inventory/adjust
- GET/PATCH /api/v1/admin/orders
- POST /api/v1/admin/orders/{id}/notes
- GET /api/v1/admin/audit-logs

Dashboard revenue uses paid orders and excludes cancelled fulfillment records. Inventory adjustments are transactionally locked and require a reason. Product deletion archives the product so historical order snapshots remain intact.

## Verification

~~~sh
php artisan test --compact
vendor/bin/pint --test
composer analyse
corepack pnpm --filter @kipi/admin typecheck
corepack pnpm --filter @kipi/admin lint
corepack pnpm --filter @kipi/admin test
corepack pnpm --filter @kipi/admin build
~~~
