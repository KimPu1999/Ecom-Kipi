#!/usr/bin/env bash
set -euo pipefail

: "${PREVIOUS_REF:?set PREVIOUS_REF to the previously verified immutable release}"
: "${STAGING_HOST:?set STAGING_HOST}"
: "${STAGING_PATH:?set STAGING_PATH}"

ssh "$STAGING_HOST" "cd '$STAGING_PATH' && git fetch --tags origin '$PREVIOUS_REF' && git checkout --detach '$PREVIOUS_REF' && docker compose -f infrastructure/docker/compose.production.yaml up -d --build"
printf 'Application rollback requested for %s; database rollback is intentionally not automatic.\n' "$PREVIOUS_REF"
