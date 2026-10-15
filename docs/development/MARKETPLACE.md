# Multi-vendor marketplace

Phase 8 adds seller onboarding, isolated seller catalog access, public storefronts, split seller orders, commission snapshots, append-only seller ledger entries, payout records, and admin review tools.

## Flow

1. An authenticated customer submits `POST /api/v1/seller/applications`.
2. An administrator with `manage_marketplace` reviews the application and approves it with a store name and unique slug.
3. Approved sellers use the Seller Portal at `http://localhost:5175/seller`.
4. Products are owned by the approved seller. Seller routes derive the seller from the authenticated user’s active membership; clients cannot select another seller.
5. Checkout keeps one parent order for the customer, then creates one `seller_order` per seller. Each seller order stores immutable commission inputs and item snapshots.
6. When the parent Stripe payment is verified, sale-credit and commission-debit ledger entries are inserted idempotently.

Public routes include `/api/v1/stores`, `/api/v1/stores/{slug}`, and seller metadata on product responses. Customer order responses include `seller_orders` for parent-order details in web and mobile clients.

## Financial controls

The default commission is `MARKETPLACE_DEFAULT_COMMISSION_BPS=1000` (10%), and administrators can create seller/category-specific rules. Ledger entries are append-only and keyed by idempotency keys. Payout requests are rejected unless `STRIPE_CONNECT_ENABLED=true` and a seller provider account ID has been configured. No local endpoint marks a payout as paid; provider onboarding, transfer creation, webhook handling, and reconciliation must be completed before production payouts are enabled.

Refund allocation tables are present for seller-level allocation and commission reversal. The provider refund workflow should populate those records before a payout is considered reconciled.

## Verification

The marketplace feature tests cover approved store visibility, cross-seller catalog isolation, split checkout creation, and the commission snapshot. Run:

```bash
cd backend/laravel-api
php artisan migrate --force
php artisan test --compact
vendor/bin/phpstan analyse --debug
vendor/bin/pint --test
```
