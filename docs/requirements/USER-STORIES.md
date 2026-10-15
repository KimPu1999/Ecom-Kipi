# User Stories and Acceptance Criteria

## Customer

| ID | Story | Acceptance criteria |
|---|---|---|
| US-C01 | As a customer, I can register an account. | Valid data creates one customer account; duplicate email returns 422; password is never returned. |
| US-C02 | As a customer, I can find products. | Search, category, brand, price, availability, sort, and pagination produce deterministic results. |
| US-C03 | As a customer, I can choose a variant. | Variant SKU, price, attributes, and availability are visible before adding to cart. |
| US-C04 | As a customer, I can manage my cart. | Add/update/remove/clear work; invalid quantity and unavailable stock return actionable errors. |
| US-C05 | As a customer, I can place an order. | Address is valid, totals are server-calculated, stock is reserved transactionally, and an order number is returned. |
| US-C06 | As a customer, I can track my order. | Only my orders are visible; status history is chronological and readable. |
| US-C07 | As a customer, I can cancel an eligible order. | Pending order cancellation releases reservations and records history. |

## Admin

| ID | Story | Acceptance criteria |
|---|---|---|
| US-A01 | As an admin, I can publish a product. | Required catalog data validates; product remains draft until explicitly published. |
| US-A02 | As an admin, I can adjust inventory. | Adjustment is atomic, cannot make available stock negative, and creates a movement record. |
| US-A03 | As an admin, I can process orders. | Only valid status transitions are allowed and actor/time/note are recorded. |
| US-A04 | As a super admin, I can manage permissions. | Permission changes are restricted, auditable, and do not expose secrets. |

## Future seller

| ID | Story | Acceptance criteria |
|---|---|---|
| US-S01 | As a seller, I can manage my catalog. | Seller cannot read or modify another seller's products. |
| US-S02 | As a seller, I can fulfill assigned order items. | Seller scope, shipment status, and payout basis are recorded independently. |
