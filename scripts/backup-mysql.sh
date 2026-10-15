#!/usr/bin/env bash
set -euo pipefail

: "${DB_HOST:?set DB_HOST}"
: "${DB_PORT:=3306}"
: "${DB_DATABASE:?set DB_DATABASE}"
: "${DB_USERNAME:?set DB_USERNAME}"
: "${DB_PASSWORD:?set DB_PASSWORD}"
: "${BACKUP_DIR:=./backups/mysql}"

mkdir -p "$BACKUP_DIR"
timestamp="$(date -u +%Y%m%dT%H%M%SZ)"
output="$BACKUP_DIR/${DB_DATABASE}-${timestamp}.sql.gz"
mysqldump --single-transaction --quick --routines --triggers --set-gtid-purged=OFF \
  --host="$DB_HOST" --port="$DB_PORT" --user="$DB_USERNAME" --password="$DB_PASSWORD" "$DB_DATABASE" \
  | gzip -9 > "$output"
if [[ -n "${BACKUP_GPG_RECIPIENT:-}" ]]; then
  gpg --batch --yes --trust-model always --recipient "$BACKUP_GPG_RECIPIENT" --encrypt "$output"
  shred -u "$output"
  output="$output.gpg"
fi
sha256sum "$output" > "$output.sha256"
printf 'Created backup %s\n' "$output"
