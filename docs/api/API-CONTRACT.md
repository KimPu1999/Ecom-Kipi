# API Contract

Base URL: /api/v1

## Conventions

Successful responses use { success, message, data }; paginated responses add { meta: { current_page, per_page, last_page, total } }. Validation returns HTTP 422 with { success: false, message, errors }.

Bearer token authentication is used by mobile and API clients. First-party web may use a Sanctum cookie mode when configured. All write requests use JSON and Form Request validation.

## Endpoint matrix

| Method | Path | Auth | Permission | Purpose |
|---|---|---|---|---|
| POST | /auth/register | Public | — | Create customer |
| POST | /auth/login | Public | — | Issue token |
| POST | /auth/logout | Customer | — | Revoke current token |
| GET | /auth/me | Customer | — | Current user |
| POST | /auth/forgot-password | Public | — | Send reset link |
| POST | /auth/reset-password | Public | — | Reset password |
| GET | /categories, /brands | Public | — | Browse taxonomy |
| GET | /products | Public | — | Filtered catalog |
| GET | /products/{slug}, /products/featured | Public | — | Product details |
| GET/POST/PATCH/DELETE | /cart, /cart/items | Customer | — | Cart operations |
| POST | /checkout/preview | Customer | — | Validate/recalculate checkout from server prices, stock, shipping, tax, and discounts |
| POST | /checkout/confirm | Customer | — | Create an idempotent order and reserve inventory |
| GET | /shipping/methods | Customer | — | List active shipping methods |
| POST | /payments/initialize | Customer | — | Create/reuse a provider payment attempt |
| GET | /payments/{payment}/status | Customer | Own payment | Verify provider payment state |
| POST | /payments/{payment}/retry | Customer | Own payment | Retry a failed payment attempt |
| POST | /webhooks/payments/{provider} | Provider | Signed request | Receive and deduplicate provider events |
| POST/DELETE | /devices/push-tokens | Customer | Own device | Register or remove an Expo push token |
| GET/PUT | /notification-preferences | Customer | Own preferences | Read or update order notification preferences |
| GET | /orders/{id}/shipments | Customer | Own order | List shipment and tracking state |
| GET | /shipments/{id}/tracking | Customer | Own shipment | Read tracking events |
| POST/GET | /orders | Customer | — | Create/list orders |
| GET | /orders/{id} | Customer | Own order | Order detail |
| POST | /orders/{id}/cancel | Customer | Own order | Cancel eligible order |
| GET/PUT | /profile | Customer | Own profile | Profile |
| GET/POST/PUT/DELETE | /addresses | Customer | Own address | Address book |
| GET | /admin/dashboard | Admin | admin role | Live dashboard aggregates and charts |
| CRUD | /admin/users | Admin | manage_users | Search and manage accounts |
| CRUD | /admin/products, /categories, /brands | Admin | manage_catalog | Catalog operations |
| GET/POST | /admin/inventory | Admin | manage_inventory | Stock and movement operations |
| GET/PATCH/POST | /admin/orders | Admin | manage_orders | Fulfillment, details, notes, shipments, and refunds |
| POST | /admin/orders/{order}/shipments | Admin | manage_orders | Create a shipment after verified payment |
| PATCH | /admin/shipments/{shipment}/status | Admin | manage_orders | Advance shipment and tracking status |
| GET/POST | /admin/orders/{order}/refunds | Admin | manage_orders | List/create provider-backed refunds |
| GET | /admin/audit-logs | Admin | view_audit_logs | Append-only admin activity |

Admin writes are audited with actor, action, resource, request ID, IP address, and redacted before/after data. Product deletion archives rather than deleting historical catalog references. Order status changes use an allow-list and inventory adjustments use row-level locks.

## Checkout preview

Preview must return current line items, availability errors, subtotal, server-selected shipping/tax/discount values, grand total, and expiry/version metadata. It must not reserve stock until order submission.

## Status codes

200 success, 201 created, 204 deleted, 400 malformed request, 401 unauthenticated, 403 unauthorized, 404 missing/ownership-hidden resource, 409 idempotency or state conflict, 422 validation/business rule failure, 429 rate limited, 500 unexpected server error.

The generated OpenAPI file is currently at docs/openapi.yaml and is the source for client generation until it is moved into this folder.
