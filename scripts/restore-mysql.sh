#!/usr/bin/env bash
set -euo pipefail

backup="${1:?usage: restore-mysql.sh /path/to/backup.sql.gz[.gpg]}"
: "${DB_HOST:?set DB_HOST}"
: "${DB_PORT:=3306}"
: "${DB_DATABASE:?set DB_DATABASE}"
: "${DB_USERNAME:?set DB_USERNAME}"
: "${DB_PASSWORD:?set DB_PASSWORD}"

[[ -f "$backup" ]] || { echo "Backup not found" >&2; exit 1; }
if [[ "$backup" == *.gpg ]]; then
  work="$(mktemp)"
  trap 'rm -f "$work"' EXIT
  gpg --batch --decrypt "$backup" > "$work"
  input="$work"
else
  input="$backup"
fi
gzip -dc "$input" | mysql --host="$DB_HOST" --port="$DB_PORT" --user="$DB_USERNAME" --password="$DB_PASSWORD" "$DB_DATABASE"
printf 'Restore completed; run smoke tests and ledger reconciliation before accepting traffic.\n'
