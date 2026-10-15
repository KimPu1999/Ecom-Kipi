#!/usr/bin/env bash
set -euo pipefail

: "${RELEASE_REF:?set RELEASE_REF to an immutable image tag or commit SHA}"
: "${STAGING_HOST:?set STAGING_HOST}"
: "${STAGING_PATH:?set STAGING_PATH}"

ssh "$STAGING_HOST" "cd '$STAGING_PATH' && git fetch --tags origin '$RELEASE_REF' && git checkout --detach '$RELEASE_REF' && docker compose -f infrastructure/docker/compose.production.yaml run --rm api php artisan migrate --force && docker compose -f infrastructure/docker/compose.production.yaml up -d --build"
printf 'Staging deployment requested for %s\n' "$RELEASE_REF"
