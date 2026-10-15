# Rollback runbook

Rollback the application to a previously verified immutable artifact. Never automatically reverse a production database migration.

1. Declare incident severity and stop further releases.
2. Capture current image tags, logs, queue state, and payment/webhook status.
3. Restore the previous application artifact with the provider’s approved deployment mechanism.
4. Keep additive database migrations in place; use a forward fix for incompatible schema changes.
5. Restart API, workers, scheduler, and reverse proxy.
6. Run `scripts/smoke-test.sh`, authentication, catalog, order read, and payment reconciliation checks.
7. Reconcile payments and seller ledgers before resuming checkout.

Trigger on critical API failure, unauthorized exposure, payment-integrity error, migration incompatibility, or sustained error-rate breach. Escalate to the incident commander and payment provider for financial incidents.
