#!/usr/bin/env bash
set -euo pipefail

base_url="${1:?usage: smoke-test.sh https://api.example.com}"
curl --fail --silent --show-error --max-time 15 "$base_url/api/v1/health" >/dev/null
ready="$(curl --fail --silent --show-error --max-time 15 "$base_url/api/v1/health/ready")"
printf '%s\n' "$ready" | grep -q '"status":"ready"'
printf 'Smoke test passed for %s\n' "$base_url"
