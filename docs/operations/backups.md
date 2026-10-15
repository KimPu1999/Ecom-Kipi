# Backup and restore runbook

Target policy to approve: RPO 15 minutes for MySQL/ledger data, RTO 60 minutes, daily full backups with 35-day retention and offsite encrypted copies. The policy is not active until the hosting provider and storage location are approved.

```bash
DB_HOST=<private-db-host> DB_DATABASE=<db> DB_USERNAME=<backup-user> DB_PASSWORD='from-secret-store' \
  BACKUP_DIR=/secure/offsite/path BACKUP_GPG_RECIPIENT=<approved-key> ./scripts/backup-mysql.sh
sha256sum -c /secure/offsite/path/<backup>.sha256
```

Restore only into an isolated recovery database:

```bash
DB_HOST=<recovery-db> DB_DATABASE=<recovery-db> DB_USERNAME=<restore-user> DB_PASSWORD='from-secret-store' \
  ./scripts/restore-mysql.sh /secure/offsite/path/<backup>.sql.gz.gpg
```

Verify migration state, order totals, payments, seller ledger balances, media references, and `/api/v1/health/ready`. Alert on backup failure, checksum mismatch, or restore-test failure.
