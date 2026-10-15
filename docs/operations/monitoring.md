# Monitoring and alerting

Required signals: API availability/readiness, 5xx rate, p95 latency, login failures, checkout failures, payment/webhook failures, queue failures, stuck reservations/orders, refund/payout failures, ledger discrepancies, DB connections, Redis health, disk, CPU/memory, and TLS expiry.

Health probes:

```bash
curl --fail https://<api-domain>/api/v1/health
curl --fail https://<api-domain>/api/v1/health/ready
```

Suggested alerts: readiness unavailable for 2 minutes (critical), 5xx >2% for 5 minutes (high), payment/webhook failure burst (critical), failed jobs >0 for 10 minutes (high), backup age >26 hours (high), TLS expiry <14 days (high), and reconciliation difference nonzero (critical). Each alert must name an owner, escalation channel, and incident runbook. Never log passwords, bearer tokens, payment secrets, or full customer addresses.
