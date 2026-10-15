# Payments, checkout, and fulfillment

Phase 6 adds an authoritative server-side checkout flow for the React storefront, React Native client, and admin console.

## Checkout lifecycle

1. `POST /checkout/preview` recalculates cart lines, stock availability, shipping, tax, and the grand total from database values.
2. `POST /checkout/confirm` accepts an `Idempotency-Key`, creates the order snapshot, and reserves inventory inside a transaction with row locks.
3. `POST /payments/initialize` creates a Stripe PaymentIntent in test mode. The server stores only provider identifiers and payment state; card data never enters this API.
4. `POST /webhooks/payments/stripe` verifies the Stripe signature, deduplicates the event, checks amount/currency, and is the authoritative source for paid status.
5. Successful payment changes the order to `payment_status=paid` and `fulfillment_status=confirmed`. Admins can then create shipments and record tracking.

The client must not treat a redirect, a client secret, or a successful API request as proof of payment. It should display success only after the order/payment status has been verified from the API.

## Local Stripe test mode

Copy the backend environment example and provide test credentials:

```dotenv
STRIPE_SECRET=sk_test_...
STRIPE_WEBHOOK_SECRET=whsec_...
STRIPE_API_URL=https://api.stripe.com/v1
```

Configure the provider to deliver events to:

```text
POST http://localhost:8000/api/v1/webhooks/payments/stripe
```

Do not enable live keys until production webhook delivery, refund policy, reconciliation, access controls, and operational monitoring have been reviewed. The current seeded shipping method is a manual-delivery MVP method priced at 0 MMK.

## Operations

- `php artisan commerce:expire-reservations` releases expired stock holds. The scheduler runs this every five minutes.
- `POST /admin/orders/{order}/shipments` creates a shipment after verified payment.
- `PATCH /admin/shipments/{shipment}/status` advances shipment state and records tracking events.
- `GET|POST /admin/orders/{order}/refunds` lists or creates provider-backed refunds with idempotency.

The Phase 6 migration is additive. Apply it with `php artisan migrate`; do not use `migrate:fresh`, `db:wipe`, or destructive rollback commands against an environment containing user data.
