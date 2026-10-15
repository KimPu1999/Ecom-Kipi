# Mobile release runbook

Verify package `com.kipi.commerce`, iOS bundle `com.kipi.commerce`, production API URL, Stripe publishable-key configuration, notification permissions, deep links, privacy disclosures, and version/build numbers.

```bash
cd apps/mobile
corepack pnpm typecheck
corepack pnpm test
npx expo config --type public
npx eas build --profile preview --platform android
npx eas build --profile preview --platform ios
```

The EAS commands require Expo, Apple, and Google credentials and are not run by the repository CI gate. Use internal testing/TestFlight before store submission. Do not publish without explicit release approval.
