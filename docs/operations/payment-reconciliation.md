# Payment reconciliation

Run the scheduled command hourly and investigate every provider/API discrepancy:

```bash
php artisan commerce:reconcile-payments
```

Compare provider intent ID, amount, currency, payment status, order status, refunds, and webhook event id. Duplicate events must be idempotent; out-of-order events must not downgrade a paid payment. Never edit payment history to force a match. Hold fulfillment or payout release while a captured amount, refund, or ledger allocation is unexplained.
