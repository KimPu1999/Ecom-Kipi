# Kipi mobile application

The mobile app is an Expo SDK 52 React Native client using Expo Router, TanStack Query, Zustand, React Hook Form, Zod, SecureStore, Expo Image, Expo Notifications, and Stripe React Native.

## Run locally

```bash
corepack pnpm install
cd apps/mobile
cp .env.example .env
corepack pnpm start
```

Use `10.0.2.2` for an Android emulator and the host machine LAN address for a physical device. Set `EXPO_PUBLIC_STRIPE_PUBLISHABLE_KEY` to a Stripe test publishable key. Never put a secret key in the mobile environment.

Stripe and notification native modules require an Expo development build; Expo Go is not sufficient for those flows.

```bash
eas build --profile development --platform android
eas build --profile development --platform ios
```

The repository includes `development`, `preview`, and `production` profiles in [eas.json](../../apps/mobile/eas.json). Actual Android/iOS builds require Expo/EAS credentials and physical-device or simulator validation; they are not claimed by local TypeScript checks.

## Implemented customer flows

- Secure login, registration, password reset, session restoration, and logout
- Home, categories, search, server-side filters, product details, variants, stock, and cart
- Address management, backend checkout preview, shipping selection, idempotent order confirmation
- Stripe test-mode payment confirmation with server/webhook-authoritative result states
- Order history, order details, shipment tracking, cancellation endpoint integration
- Profile editing, notification preferences, and Expo push-token registration
- Query caching, pull-to-refresh, loading/error/empty states, and accessible labels

The backend notification endpoints are additive and require `php artisan migrate`. Push delivery itself must be connected to a queued Expo push provider in the deployment environment.
