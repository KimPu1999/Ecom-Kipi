# Business Rules

1. Customer email is unique case-insensitively at the application boundary and uniquely constrained in the database.
2. Passwords use Laravel hashing; plaintext passwords and tokens are never logged.
3. Product variants have globally unique SKUs.
4. Money uses integer minor units and a three-letter currency code; floating point is prohibited for totals.
5. Only active variants belonging to published products may enter a customer cart.
6. Available stock equals quantity minus reserved_quantity; it must never be negative.
7. Cart quantity is at least 1 and capped by configurable policy; current API cap is 1000.
8. Checkout recalculates line prices from the catalog and does not trust client totals.
9. Checkout locks/reserves inventory in a database transaction and accepts an idempotency key.
10. Payment status remains pending until a verified payment event is processed.
11. Order items store immutable product name, SKU, quantity, unit price, attributes, and line total snapshots.
12. Customers can only read or mutate their own addresses, carts, and orders.
13. Order fulfillment transitions are explicit: pending to processing to shipped to delivered; pending/processing may be cancelled according to policy.
14. Cancellation releases reservations exactly once and records status history.
15. Admin actions require role and policy authorization; UI hiding is not authorization.
16. Product deletion is subject to foreign-key rules and should become archive/unpublish when historical orders depend on it.
17. Refund eligibility, tax, shipping zones, payment methods, guest checkout, and retention require business approval before release.
