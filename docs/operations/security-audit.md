# Security audit report

## Implemented controls

- Laravel validation, Sanctum bearer tokens, role/permission middleware, seller-derived scoping, idempotent checkout/payment/ledger keys, private document storage model, explicit CORS origins, rate limiting, and response security headers.
- CI hooks for Composer audit, pnpm audit, CodeQL, and Gitleaks.
- Production container keeps MySQL and Redis on internal networks and uses PHP-FPM behind Nginx.

## Evidence and limitations

Static checks and authorization feature tests pass. Composer/npm advisory services were unreachable in this environment, so no clean dependency-vulnerability result is claimed. Manual TLS, secret-store, container-image, network, file-upload, keyboard/screen-reader, and provider security review require staging access. Treat those as release gates.
