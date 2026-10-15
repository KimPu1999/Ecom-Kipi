# Database migration runbook

All migrations must be additive or use expand-and-contract. Review SQL and indexes, estimate lock time, test on a production-like staging copy, and take a verified backup before high-risk changes.

```bash
docker compose -f infrastructure/docker/compose.production.yaml run --rm api php artisan migrate:status
docker compose -f infrastructure/docker/compose.production.yaml run --rm api php artisan migrate --force
docker compose -f infrastructure/docker/compose.production.yaml run --rm api php artisan optimize:clear
docker compose -f infrastructure/docker/compose.production.yaml run --rm api php artisan migrate:status
```

Never run `migrate:fresh`, `db:wipe`, or a reset command against staging/production. A failed migration requires provider/database-owner escalation and forward recovery; application rollback does not imply schema rollback.
