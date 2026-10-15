# User Flows

## Customer purchase

~~~mermaid
flowchart LR
  A[Home] --> B[Product Listing]
  B --> C[Product Details]
  C --> D{Variant available?}
  D -- No --> C
  D -- Yes --> E[Add to Cart]
  E --> F[Cart]
  F --> G[Checkout]
  G --> H[Address validation]
  H --> I[Payment pending/verified]
  I --> J[Order Confirmation]
  J --> K[Order Tracking]
~~~

## Customer account

~~~mermaid
flowchart LR
  A[Register] --> B[Verify / Activate]
  B --> C[Login]
  C --> D[Profile]
  D --> E[Addresses]
  D --> F[Order History]
  F --> G[Order Details]
~~~

## Admin product

~~~mermaid
flowchart LR
  A[Admin Login] --> B[Dashboard]
  B --> C[Products]
  C --> D[Create/Edit Product]
  D --> E[Add Variants]
  E --> F[Add Images]
  F --> G[Set Inventory]
  G --> H[Publish]
~~~

## Admin order

~~~mermaid
flowchart LR
  A[Dashboard] --> B[Orders]
  B --> C[Order Details]
  C --> D[Confirm / Process]
  D --> E[Fulfill]
  E --> F[Ship]
  F --> G[Deliver]
~~~

Every flow needs loading, validation, empty, authorization, network failure, and retry states. Success states must provide the next action; errors must identify the field or operation that can be corrected.
