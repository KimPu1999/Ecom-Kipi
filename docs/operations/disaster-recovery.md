# Disaster recovery runbook

Create an isolated recovery environment and use a recent encrypted backup. Do not test recovery against production.

1. Declare the incident and preserve evidence.
2. Provision private MySQL, Redis, object storage, and an approved application host.
3. Restore MySQL with `scripts/restore-mysql.sh`; restore media and private seller documents from encrypted storage.
4. Inject secrets through the approved secret store; never copy a production `.env` into chat or source control.
5. Start API, workers, scheduler, and proxy; run migrations only after schema review.
6. Verify auth, catalog, customer orders, payment records, seller orders, ledger invariants, health, and queue processing.
7. Record recovery duration, missing data, and follow-up actions.

Scenarios: database corruption, deletion, host loss, Redis outage, webhook interruption, queue backlog, object storage outage, and compromised credentials. Credential compromise requires immediate provider revocation and security escalation.
