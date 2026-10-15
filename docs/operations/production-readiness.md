# Production readiness audit

Status: **BLOCKED — release candidate only** (reviewed 2026-10-12).

## Verified

- Laravel API, customer web, admin, seller portal, and Expo mobile projects exist.
- Additive Phase 8 marketplace migration is applied locally.
- Backend: 20 tests / 93 assertions, PHPStan, and Pint pass.
- Web, admin, seller, and mobile typechecks pass; web/admin/seller/mobile tests pass.
- Web and seller production bundles build successfully.
- Health and readiness endpoints exist; scheduled reservation/payment reconciliation commands exist.
- CI, CodeQL/Gitleaks hooks, production container files, backup scripts, and runbooks are checked in.

## Blockers

- No approved hosting provider, staging environment, production domain, TLS certificate, or deployment identity is configured.
- No production secret store or production `.env` has been provisioned.
- Stripe live configuration and Stripe Connect onboarding are not enabled; payout requests are intentionally blocked.
- Refund-to-seller allocation and provider payout reconciliation require final provider workflow validation.
- iOS/Android EAS release builds were not generated; Apple/Google signing credentials are unavailable.
- Playwright execution is configured but not run here because bundled Chromium is unsupported on this macOS runtime and no local preview server could bind inside the sandbox.
- Backup creation, restore, disaster-recovery, and rollback drills are documented but not successful until run in an isolated staging environment.

## Findings

| Severity | Finding | Gate |
| --- | --- | --- |
| Critical | Live payment, payout, and secret configuration unavailable | Blocks production |
| High | Staging, TLS, backups, restore evidence, and rollback evidence unavailable | Blocks production |
| High | Native mobile release artifacts not built or signed | Blocks store release |
| Medium | Automated accessibility/performance scans require a running staging URL | Blocks accessibility/performance sign-off |
| Low | Provider-specific dashboards and alert destinations are intentionally unselected | Requires ops decision |

## Release sequence

Run CI, deploy an immutable candidate to staging, run migrations and smoke/E2E tests, verify backup/restore, validate sandbox payment and marketplace reconciliation, obtain written production approval, then deploy. No production command is executed by this repository workflow.
