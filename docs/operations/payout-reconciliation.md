# Payout reconciliation

Stripe Connect/payout-provider onboarding is disabled by default (`STRIPE_CONNECT_ENABLED=false`). A payout must not be marked paid locally.

Before enabling a provider, verify seller account ownership, provider payout ID, eligible ledger balance, currency, commission/refund adjustments, transfer amount, provider settlement, and idempotency key. Record expected, actual, and difference amounts in reconciliation records. Escalate any nonzero difference or duplicate provider reference to finance and the incident commander.
