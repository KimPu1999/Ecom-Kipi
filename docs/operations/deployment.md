# Deployment runbook

Purpose: deploy a reviewed immutable release to an approved staging or production host.

Responsible role: release engineer. Required access: repository, container registry, host deployment identity, secret store, and monitoring.

```bash
export RELEASE_REF=<immutable-commit-or-image-tag>
export DEPLOY_HOST=<approved-host>
export DEPLOY_PATH=/srv/kipi
ssh "$DEPLOY_HOST" "cd '$DEPLOY_PATH' && git fetch origin '$RELEASE_REF' && git checkout --detach '$RELEASE_REF'"
ssh "$DEPLOY_HOST" "cd '$DEPLOY_PATH' && docker compose -f infrastructure/docker/compose.production.yaml config"
ssh "$DEPLOY_HOST" "cd '$DEPLOY_PATH' && docker compose -f infrastructure/docker/compose.production.yaml run --rm api php artisan migrate --force"
ssh "$DEPLOY_HOST" "cd '$DEPLOY_PATH' && docker compose -f infrastructure/docker/compose.production.yaml up -d --build"
./scripts/smoke-test.sh https://<approved-api-domain>
```

Verify `/api/v1/health/ready`, queue worker health, scheduler logs, TLS, storefront, admin, seller portal, login, catalog, and sandbox payment webhook delivery. Do not put secrets in shell history or CI output. Production deployment requires an approved GitHub environment and human approval; this runbook does not perform it automatically.
