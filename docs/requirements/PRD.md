# Product Requirements Document

## 1. Product vision

Kipi E-Commerce is a single-vendor commerce platform that lets customers discover products, purchase securely, and track fulfillment across a responsive React website and React Native apps. Laravel is the shared API and business-policy layer; the admin application operates the catalog, inventory, and orders.

The first release optimizes for trustworthy checkout, accurate inventory, fast catalog discovery, and a foundation that can later support multiple sellers without replacing the customer experience or order model.

## 2. Business goals

1. Launch a reliable single-vendor storefront on web, iOS, and Android.
2. Reduce manual order handling through admin catalog, inventory, and fulfillment workflows.
3. Establish reusable API, design-system, and analytics foundations.
4. Preserve seller, commission, payout, and fulfillment extension points for marketplace expansion.

Success metrics are proposed assumptions until approved: checkout completion rate, order error rate, inventory discrepancy rate, repeat purchase rate, page load performance, and support contacts per order.

## 3. Target users

### Customer

Needs a low-friction way to find available products, compare variants, purchase with confidence, and understand order status.

### Administrator

Operates daily commerce: product publishing, stock adjustments, order processing, and customer support.

### Super administrator

Controls administrators, permissions, global settings, audit access, and operational safeguards.

### Future seller

Owns a storefront, catalog, stock, fulfillment, and payout view in a future marketplace release.

## 4. Functional requirements

| Area | Requirement | Priority |
|---|---|---|
| Authentication | Register, login, logout, password reset, token revocation, account status | P0 |
| Catalog | Categories, brands, products, variants, images, availability, featured products | P0 |
| Discovery | Search, category/brand filters, price filters, sorting, pagination | P0 |
| Cart | Add/update/remove/clear, quantity validation, server prices, availability feedback | P0 |
| Checkout | Address, preview, order submission, idempotency, server-calculated totals | P0 |
| Payments | Verified payment state; gateway integration after MVP | P0/P1 |
| Orders | History, details, status history, cancellation rules, ownership checks | P0 |
| Inventory | Quantity, reservations, movements, low-stock threshold, concurrency safety | P0 |
| Admin | Dashboard, catalog CRUD, inventory, orders, users, permissions | P0 |
| Notifications | Order and account events; email/push delivery after MVP | P1 |
| Marketplace | Sellers, commissions, payouts, seller fulfillment | Future |

## 5. Non-functional requirements

The following targets are proposed assumptions and require product/operations approval:

- Performance: p95 API response under 500 ms for catalog reads and under 1 second for normal writes, excluding third-party payment calls.
- Availability: 99.5% monthly availability for MVP; 99.9% after production hardening.
- Security: HTTPS, hashed passwords, Sanctum tokens, authorization policies, rate limiting, secure CORS, auditability for admin actions, and no secrets in source control.
- Scalability: stateless API workers, queued notifications, Redis-compatible cache/queue, object storage for images, and indexed catalog/order queries.
- Reliability: transactional checkout and inventory reservation; automated backups with a tested restore procedure.
- Accessibility: WCAG 2.2 AA target for customer and admin web experiences.
- Responsive behavior: supported reference widths 375, 768, and 1440 px with fluid behavior between them.
- Privacy: least-privilege access, export/delete policy to be confirmed, retention policy to be approved.

## 6. Assumptions and open decisions

| Decision | Current assumption | Owner / decision needed |
|---|---|---|
| Currency | MMK; integer minor units are used in API/database | Business owner |
| Tax | Server-owned calculation; rate and jurisdiction are not yet defined | Finance |
| Payments | Manual/test pending state in Phase 3; gateway in Phase 6 | Business owner |
| Payment methods | One local gateway plus cash/manual option is expected but unconfirmed | Business owner |
| Shipping | One default shipping method for MVP; regions and pricing unconfirmed | Operations |
| Guest checkout | Disabled for MVP; authenticated checkout only | Product owner |
| Email verification | Required before sensitive account operations; exact activation point unconfirmed | Product owner |
| Returns/refunds | Out of MVP; policy and eligibility window unconfirmed | Operations |
| Product images | S3-compatible storage, signed/admin-protected upload flow | Engineering |
| Marketplace | Seller data is reserved, but seller UI and payouts are future scope | Product owner |

## 7. Out of scope for MVP

Guest checkout, marketplace seller onboarding, split payments, payouts, loyalty, recommendations, advanced promotions, subscription commerce, international tax, automated returns, and full payment-gateway reconciliation.

## 8. Dependencies

MySQL, Redis, object storage, payment provider credentials, shipping policy, tax policy, transactional email, push notification credentials, app-store accounts, production observability, backups, and approved brand/product imagery.
