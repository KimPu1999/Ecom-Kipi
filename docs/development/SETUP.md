# Development setup

## Prerequisites

- PHP 8.3+, Composer 2+
- Node.js 20+ and pnpm 9+
- Docker Desktop for MySQL and Redis
- Expo tooling for mobile development

## Start dependencies

~~~sh
docker compose up -d mysql redis
~~~

## Backend

~~~sh
cd backend/laravel-api
cp .env.example .env
composer install
php artisan key:generate
php artisan migrate
php artisan serve
~~~

The public health URL is GET /api/v1/health; readiness is GET /api/v1/health/ready.

## Frontends

~~~sh
corepack pnpm install

# Run each in a separate terminal
corepack pnpm dev:web      # http://localhost:5173
corepack pnpm dev:admin    # http://localhost:5174/admin
corepack pnpm dev:seller   # http://localhost:5175/seller
corepack pnpm dev:mobile   # Expo QR/dev server
~~~

Copy each app's `.env.example` before starting it: `apps/web`, `apps/admin`, `apps/seller`, and `apps/mobile`. Never commit real secrets.
