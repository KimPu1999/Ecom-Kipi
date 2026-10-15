# Customer storefront

The customer React application lives in `apps/web` and runs at the Vite development port. It uses TanStack Query for Laravel-backed server state and keeps the current customer session in the in-memory Zustand store; bearer tokens are not written to localStorage.

Implemented routes include:

- `/`, `/products`, `/products/:slug`, and `/search?q=...`
- `/cart`, `/checkout`
- `/login`, `/register`, `/forgot-password`
- `/account`, `/account/addresses`, `/account/orders`, and `/account/orders/:id`

The storefront API adapter is `apps/web/src/services/storefrontApi.ts`. Catalog filters are URL-driven and map to the Laravel catalog query contract. Checkout uses `POST /api/v1/checkout/preview` for server-calculated totals and creates only a pending order; payment processing is intentionally deferred to Phase 6.

Run the app with:

    corepack pnpm --filter @kipi/web dev

Validate with:

    corepack pnpm --filter @kipi/web test
    corepack pnpm --filter @kipi/web lint
    corepack pnpm --filter @kipi/web typecheck
    corepack pnpm --filter @kipi/web build
