# User Roles and Permissions

| Role | Scope | Core permissions |
|---|---|---|
| Customer | Own account and orders | Browse, cart, checkout, manage own profile/addresses, view/cancel eligible own orders |
| Admin | Operational commerce | Manage catalog, inventory, orders, view users, manage operational settings |
| Super admin | Platform governance | Manage admins, roles, permissions, global settings, audit logs, all admin actions |
| Seller (future) | Own seller scope | Manage storefront products/stock, fulfill seller orders, view commissions/payouts |

## Authorization rules

- Authentication is required for account, cart, checkout, and order endpoints.
- Policies enforce ownership for customer-owned resources.
- Admin middleware protects /api/v1/admin/*.
- Super-admin-only operations must use explicit permissions, not only a role label.
- Seller access must be scoped by seller_id on every future query and mutation.
- UI navigation visibility is advisory; API authorization is authoritative.

## Permission catalog

manage_users, manage_catalog, manage_inventory, manage_orders, manage_settings, view_reports, manage_permissions, view_audit_logs, manage_sellers, and manage_payouts.
