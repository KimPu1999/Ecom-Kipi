# Performance test plan

Run only against isolated staging with sandbox payments. Define budgets before execution: public catalog p95 <500ms, authenticated cart/checkout preview p95 <750ms, 5xx <1%, and no negative inventory or duplicate idempotent orders.

Use Lighthouse against each web app and k6 against health, catalog, search, login, cart, checkout preview, and order reads. Capture DB slow queries, queue latency, lock waits, connection saturation, bundle sizes, LCP, INP, and CLS. Do not load-test production or live payment endpoints.
