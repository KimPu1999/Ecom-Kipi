# Security operations

Use managed secret storage for `APP_KEY`, database/Redis credentials, Stripe secrets, webhook secrets, SMTP/object-storage keys, mobile signing credentials, and monitoring tokens. Separate staging and production identities; use least privilege and short-lived CI credentials.

Run `composer audit --locked`, `pnpm audit --audit-level high`, CodeQL, and Gitleaks in CI. Review CORS origins, HTTPS, secure/httpOnly cookies, trusted proxies, rate limits, authorization boundaries, private document access, and audit logs before release. Rotate or revoke credentials immediately after suspected exposure; do not rotate live credentials without incident-owner approval.
