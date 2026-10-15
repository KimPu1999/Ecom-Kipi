# Prioritized Product Backlog

| Epic | Story | Task | Priority | Dependency | Effort | Phase |
|---|---|---|---|---|---:|---|
| INF | INF-01 | Docker/local environment and CI | P0 | — | 2d | 2 |
| AUTH | AUTH-01 | Sanctum registration/login/logout/reset | P0 | INF | 3d | 2/3 |
| AUTH | AUTH-02 | Roles, permissions, policies, admin guard | P0 | AUTH-01 | 2d | 3 |
| DATA | DATA-01 | MySQL migrations, factories, seeders | P0 | — | 4d | 3 |
| CAT | CAT-01 | Catalog CRUD and publication | P0 | DATA, AUTH-02 | 4d | 3 |
| CAT | CAT-02 | Public search/filter/sort/pagination | P0 | CAT-01 | 3d | 3 |
| INV | INV-01 | Inventory movements and row-lock reservation | P0 | DATA | 3d | 3 |
| CART | CART-01 | Cart CRUD and availability validation | P0 | CAT-02, INV-01 | 3d | 3 |
| ORDER | ORD-01 | Checkout preview and authoritative pricing | P0 | CART-01 | 3d | 4 |
| ORDER | ORD-02 | Idempotent order creation and state machine | P0 | ORD-01, INV-01 | 4d | 3/4 |
| ADMIN | ADM-01 | Admin catalog/inventory/order screens | P0 | CAT, INV, ORD | 6d | 5 |
| WEB | WEB-01 | Customer React shell and design tokens | P0 | Design system | 3d | 5 |
| WEB | WEB-02 | Home/catalog/detail/cart/checkout/account | P0 | API, WEB-01 | 10d | 5 |
| MOBILE | MOB-01 | React Native auth/catalog/cart shell | P1 | API, WEB-01 | 7d | 6 |
| PAY | PAY-01 | Payment gateway intents and webhooks | P1 | ORD-02 | 5d | 6 |
| SHIP | SHIP-01 | Shipping methods and tracking | P1 | ORD-02 | 5d | 6 |
| ENG | ENG-01 | Notifications and queues | P1 | PAY/SHIP | 3d | 6 |
| SEARCH | SEA-01 | Meilisearch indexing | P2 | CAT-01 | 3d | 7 |
| MARKET | MKT-01 | Seller onboarding and seller scope | P2 | PAY, SHIP | 8d | 8 |
| MARKET | MKT-02 | Commissions, payouts, seller dashboard | P2 | MKT-01 | 8d | 8 |
| QA | QA-01 | Pest/Vitest/Playwright coverage and security testing | P0 | Each epic | 5d | All |

Effort is an initial engineering estimate in person-days and must be re-estimated after technical spikes.
