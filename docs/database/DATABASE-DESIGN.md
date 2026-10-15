# Database Design

## Conventions

- MySQL 8+, InnoDB, UTC timestamps.
- BIGINT identifiers for high-growth tables; foreign keys match parent type.
- Money is BIGINT UNSIGNED minor units plus CHAR(3) currency.
- JSON is used only for flexible variant attributes and immutable address snapshots.
- Every business table has timestamps; operational history is append-oriented.
- Use foreign keys, unique constraints, and composite indexes to enforce invariants.

## Existing Phase 3 tables

| Table | Purpose | Key constraints/indexes |
|---|---|---|
| users | Accounts | unique email, status index |
| roles / permissions | Authorization vocabulary | unique name |
| role_user / permission_role | Many-to-many assignments | composite primary keys |
| addresses | Customer address book | user/status index |
| categories | Hierarchical catalog grouping | unique slug, parent FK |
| brands | Catalog brands | unique slug |
| products | Product identity and publication state | category/status index, unique slug |
| product_variants | Sellable SKU and price | unique SKU, product/active index |
| product_images | Product media ordering | product FK |
| inventories | Quantity and reservations | unique variant FK |
| inventory_movements | Auditable quantity events | reference and inventory indexes |
| carts / cart_items | Active customer cart | unique user and cart/variant |
| orders | Checkout aggregate | unique order number and idempotency key |
| order_items | Immutable checkout snapshots | order FK, nullable variant FK |
| order_status_history | State transition audit | order/status indexes |

## Phase 1 extension tables

| Table | Important columns | Purpose |
|---|---|---|
| payments | id, order_id, provider, provider_reference, amount_minor, currency, status, paid_at | Provider-agnostic payment aggregate |
| payment_events | id, payment_id, provider_event_id, event_type, payload, processed_at | Idempotent webhook/event ledger |
| shipments | id, order_id, carrier, service, tracking_number, status, shipped_at, delivered_at | Shipment lifecycle |
| shipment_tracking | id, shipment_id, status, location, occurred_at, payload | Carrier status history |
| sellers | id, user_id, name, slug, status, commission_rate | Future marketplace owner |
| seller_documents | id, seller_id, type, storage_key, status, reviewed_by | KYC/compliance documents |
| commissions | id, order_item_id, seller_id, rate, amount_minor, status | Seller earnings basis |
| payouts | id, seller_id, amount_minor, currency, provider_reference, status, paid_at | Seller settlement |

Payments and shipment tables should be added in the payment/shipping phase; seller tables can be added before marketplace launch without changing customer order snapshots. Future products.seller_id, order-item seller ownership, and seller-scoped policies provide the expansion seam.

## Integrity rules

Inventory reservation uses row locks. available = quantity - reserved_quantity. Order item snapshots survive product edits/deletes. Payment events have unique provider event IDs. Payouts derive from immutable order items and commission records, never live product prices.
