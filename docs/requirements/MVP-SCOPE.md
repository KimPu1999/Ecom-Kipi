# MVP Scope

## Must have

- Customer registration, login, logout, password reset, and profile.
- Category and brand browsing.
- Product listing, details, variants, images, search, filters, sorting, and pagination.
- Authenticated cart with stock validation and server-calculated totals.
- Address book and checkout.
- Pending/manual payment state with no false paid status.
- Orders, order history, order details, cancellation, and status history.
- Inventory quantity, reservations, movements, and low-stock visibility.
- Admin authentication and role protection.
- Admin product/category/brand/variant/image CRUD.
- Admin inventory adjustment and order status workflows.
- Responsive customer website and core mobile customer flows.

## Should have after MVP

Wishlist, reviews, coupons, promotional banners, email/push notifications, refunds, returns, dashboard analytics, Meilisearch, and richer shipping methods.

## Future

Seller onboarding, seller storefronts, seller inventory and fulfillment, commissions, payouts, split orders, loyalty, recommendations, advanced analytics, and multi-region commerce.

## MVP release guardrails

- No order is marked paid without verified provider confirmation.
- Checkout is idempotent and cannot oversell inventory.
- Customers can only access their own addresses and orders.
- Admin routes are protected by role/policy checks.
- A separate test database is used for automated verification.
