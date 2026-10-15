# System Architecture

## Context

~~~text
React Web -------\
React Native -----+-- HTTPS JSON /api/v1 -- Laravel API
React Admin -----/                         |
                                   MySQL / Redis / S3
                                   Queue / Mail / Payment
~~~

## Responsibilities

- Clients: presentation, local UI state, optimistic feedback, navigation, and API consumption.
- Laravel API: authentication, authorization, validation, pricing policy, inventory locking, order state, and response contracts.
- MySQL: transactional source of truth for users, catalog, inventory, carts, and orders.
- Redis: cache, queues, rate-limit support, and short-lived operational state where configured.
- S3-compatible storage: product images and future documents.
- Workers: email, push notifications, image processing, search indexing, and reconciliation.

## Boundaries

The API is versioned at /api/v1; clients must not duplicate pricing, inventory, payment verification, or authorization rules. Admin and future seller interfaces use the same API with policy-scoped endpoints.

## Environments

Local uses SQLite or MySQL, queue sync, and log mail. CI uses an isolated test database. Staging mirrors production integrations with sandbox payment credentials. Production uses MySQL, Redis, object storage, queue workers, HTTPS, monitoring, backups, and secret management.

## Security controls

Sanctum bearer tokens for mobile/API clients, secure cookie/CSRF mode where applicable for first-party web, password hashing, request validation, rate limiting, CORS allowlist, policy checks, ownership queries, safe upload validation, encrypted transport, structured audit events, and least-privilege infrastructure credentials.
