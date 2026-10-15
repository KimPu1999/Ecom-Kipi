# Release candidate record

Candidate state: **not approved for production**.

## Verified locally

- `php artisan test --compact`: 21 passed, 98 assertions.
- `vendor/bin/pint --test`: passed.
- `vendor/bin/phpstan analyse --debug`: passed.
- Web, admin, seller, and mobile TypeScript checks: passed.
- Web and seller production builds: passed.
- Seller/web/admin/mobile unit test suites: passed in the preceding Phase 8 verification; seller portal smoke test remains passing.
- Playwright test discovery: one storefront accessibility smoke test discovered.
- GitHub Actions and production Compose YAML: parsed successfully.
- Marketplace reconciliation command: clean local report with zero seller orders and zero exceptions.

## Not verified

- Composer/npm vulnerability advisories because external registries were unreachable.
- Playwright browser execution because the bundled browser is unsupported on this macOS runtime and the local preview server cannot bind inside the sandbox.
- Docker image build because Docker is unavailable in this environment.
- Staging/production deployment, TLS, secret store, monitoring, backup/restore, disaster recovery, rollback, payment-provider sandbox, Stripe Connect, and native EAS release builds.

Release approval remains blocked until an authorized operator supplies the approved environment and records successful evidence for each item above.
