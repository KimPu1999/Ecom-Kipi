# Entity Relationship Diagram

~~~mermaid
erDiagram
  USERS ||--o{ ADDRESSES : owns
  USERS }o--o{ ROLES : assigned
  ROLES }o--o{ PERMISSIONS : grants
  USERS ||--o{ ORDERS : places
  CATEGORIES ||--o{ PRODUCTS : groups
  BRANDS ||--o{ PRODUCTS : labels
  PRODUCTS ||--o{ PRODUCT_VARIANTS : has
  PRODUCTS ||--o{ PRODUCT_IMAGES : displays
  PRODUCT_VARIANTS ||--|| INVENTORIES : tracks
  INVENTORIES ||--o{ INVENTORY_MOVEMENTS : records
  USERS ||--o| CARTS : owns
  CARTS ||--o{ CART_ITEMS : contains
  PRODUCT_VARIANTS ||--o{ CART_ITEMS : selected
  ORDERS ||--o{ ORDER_ITEMS : snapshots
  ORDERS ||--o{ ORDER_STATUS_HISTORY : changes
  PRODUCT_VARIANTS ||--o{ ORDER_ITEMS : references
  ORDERS ||--o{ PAYMENTS : paid_by
  PAYMENTS ||--o{ PAYMENT_EVENTS : receives
  ORDERS ||--o{ SHIPMENTS : fulfilled_by
  SHIPMENTS ||--o{ SHIPMENT_TRACKING : updates
  SELLERS ||--o{ PRODUCTS : owns_future
  SELLERS ||--o{ COMMISSIONS : earns
  SELLERS ||--o{ PAYOUTS : receives
  SELLERS ||--o{ SELLER_DOCUMENTS : verifies
  ORDER_ITEMS ||--o{ COMMISSIONS : basis

  USERS { bigint id PK }
  PRODUCTS { bigint id PK bigint seller_id FK nullable }
  PRODUCT_VARIANTS { bigint id PK bigint product_id FK string sku UK bigint price_minor }
  INVENTORIES { bigint id PK bigint product_variant_id FK UK int quantity int reserved_quantity }
  ORDERS { bigint id PK bigint user_id FK string order_number UK bigint grand_total_minor }
  ORDER_ITEMS { bigint id PK bigint order_id FK string product_name string sku bigint unit_price_minor }
  PAYMENTS { bigint id PK bigint order_id FK string provider_reference }
  SHIPMENTS { bigint id PK bigint order_id FK string tracking_number }
  SELLERS { bigint id PK bigint user_id FK string slug UK }
~~~
