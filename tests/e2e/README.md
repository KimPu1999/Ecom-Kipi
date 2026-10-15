# End-to-end tests

These tests run only against an isolated staging or local preview server. They must never receive production credentials or point at a production payment provider.

```bash
corepack pnpm install
corepack pnpm exec playwright install chromium
E2E_BASE_URL=http://127.0.0.1:4173 corepack pnpm exec playwright test
```

The smoke test includes an accessibility scan using axe-core. Passing automated axe checks is not a substitute for manual keyboard, screen-reader, VoiceOver, or TalkBack review.
