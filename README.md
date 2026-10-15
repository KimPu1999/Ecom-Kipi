# Kipi E-Commerce Platform

Monorepo foundation for the Kipi storefront, admin console, mobile apps, and Laravel API.

## Repository layout

- apps/web — React + TypeScript + Vite customer storefront
- apps/admin — React + TypeScript + Vite operations console
- apps/seller — React + TypeScript + Vite seller portal
- apps/mobile — React Native + Expo + TypeScript app
- backend/laravel-api — Laravel REST API with Sanctum
- packages/types — shared API/domain types
- packages/api-client — typed Axios client with browser and mobile auth adapters
- packages/validation — shared Zod schemas
- packages/config — shared frontend tokens and config
- infrastructure/docker — local container assets
- docs — requirements, architecture, design, API, and development docs

## Local setup

1. Start MySQL and Redis:

~~~bash
docker compose up -d mysql redis
~~~

2. Install JavaScript workspaces:

~~~bash
corepack pnpm install
~~~

3. Configure and start Laravel:

~~~bash
cd backend/laravel-api
cp .env.example .env
composer install
php artisan key:generate
php artisan migrate
php artisan serve
~~~

4. Start a client from the repository root:

~~~bash
corepack pnpm dev:web
corepack pnpm dev:admin
corepack pnpm --filter @kipi/seller dev
corepack pnpm dev:mobile
~~~

The API base URL defaults to http://localhost:8000/api/v1. Frontend overrides are VITE_API_URL, VITE_ADMIN_API_URL, and EXPO_PUBLIC_API_URL.

The administrator control center runs at http://localhost:5174. See docs/development/ADMIN.md for roles, permissions, endpoints, and verification. See docs/development/STOREFRONT.md for customer routes and API integration. See docs/development/PAYMENTS.md for checkout, Stripe test mode, fulfillment, reservations, and refunds.
See docs/development/MOBILE.md for the Expo mobile application, development builds, native payment modules, and device setup.
See docs/development/MARKETPLACE.md for seller onboarding, public stores, split orders, commissions, ledger controls, and payout-provider requirements.
See [docs/operations/production-readiness.md](docs/operations/production-readiness.md) and [docs/operations/deployment.md](docs/operations/deployment.md) for the Phase 9 release gate and deployment runbook.

## Health endpoints

- GET /api/v1/health — public liveness
- GET /api/v1/health/ready — MySQL and Redis readiness summary

## Verification

~~~bash
cd backend/laravel-api
php artisan test --compact
vendor/bin/pint --test

cd ../..
corepack pnpm --filter @kipi/web typecheck
corepack pnpm --filter @kipi/admin typecheck
corepack pnpm --filter @kipi/mobile typecheck
corepack pnpm --filter @kipi/seller typecheck
corepack pnpm --filter @kipi/web test
corepack pnpm --filter @kipi/admin test
~~~

Phase 1 product, architecture, database, API, design, and planning documentation is under [docs](docs/). The editable design artifact is linked from [FIGMA-HANDOFF.md](docs/design/FIGMA-HANDOFF.md).
# kipi-Ecom
