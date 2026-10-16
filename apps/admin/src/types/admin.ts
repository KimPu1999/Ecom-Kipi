export interface Pagination<T> {
  data: T[]
  meta?: {
    current_page: number
    per_page: number
    last_page: number
    total: number
  }
}

export interface ShippingCarrier {
  id: number
  name: string
  code: string
  type: string
  tracking_url: string | null
  is_active: boolean
  sort_order: number
  created_at?: string
  updated_at?: string
}

export interface ShippingMethod {
  id: number
  code: string
  name: string
  description: string | null
  price_minor: number
  currency: string
  is_active: boolean
  sort_order: number
  created_at?: string
  updated_at?: string
}

export interface DashboardData {
  range: { from: string; to: string }
  metrics: {
    customers: number
    products: number
    orders: number
    paid_revenue: number
    pending_orders: number
    low_stock_products: number
  }
  sales_trend: { date: string; revenue: number; orders: number }[]
  status_distribution: { status: string; count: number }[]
  top_products: { name: string; quantity: number; revenue: number }[]
  recent_orders: Order[]
  latest_customers: User[]
  low_stock: InventoryRow[]
  recent_activity: AuditLog[]
}

export interface User {
  id: number
  name: string
  email: string
  phone: string | null
  status: string
  roles?: string[]
  created_at?: string
}

export interface Category {
  id: number
  name: string
  slug: string
  description: string | null
  color: string | null
  is_active: boolean
  sort_order: number
  parent?: Category | null
}

export interface Brand {
  id: number
  name: string
  slug: string
  description: string | null
  logo_url: string | null
  is_active: boolean
}

export interface Variant {
  id: number
  sku: string
  price_minor: number
  compare_at_price_minor: number | null
  currency: string
  attributes: Record<string, string> | null
  is_active: boolean
  available_quantity: number
}

export interface Product {
  id: number
  name: string
  slug: string
  description: string | null
  status: string
  is_featured: boolean
  category?: Category
  brand?: Brand
  seller?: { id: number; store_name: string; slug: string } | null
  images?: ProductImage[]
  variants?: Variant[]
}

export interface ProductImage {
  id: number
  url: string
  alt_text: string | null
  sort_order: number
  is_primary: boolean
}

export interface InventoryRow {
  id: number
  variant_id: number
  product: string | null
  sku: string | null
  quantity: number
  reserved_quantity: number
  available_quantity: number
  low_stock_threshold: number
  is_low_stock: boolean
}

export interface Order {
  id: number
  order_number: string
  subtotal_minor: number
  discount_minor: number
  shipping_minor: number
  tax_minor: number
  grand_total_minor: number
  currency: string
  payment_status: string
  fulfillment_status: string
  placed_at: string | null
  shipping_address?: Record<string, unknown> | null
  user?: User
  shipping_method?: { id: number; name: string; code: string; price_minor: number; currency: string } | null
  seller_orders?: { id: number; order_number: string; seller?: { id: number; store_name: string }; status: string; payment_status: string; fulfillment_status: string; subtotal_minor: number; commission_minor: number; net_minor: number; currency: string }[]
  items?: { id?: number; product_name: string; sku: string; quantity: number; unit_price_minor: number; line_total_minor?: number; product_image?: string | null; attributes?: Record<string, unknown> | null }[]
  status_history?: { id: number; from_status: string | null; to_status: string; note: string | null; created_at: string }[]
  notes?: { id: number; note: string; created_at: string; user?: User }[]
  payments?: { id: number; provider: string; status: string; amount_minor: number; currency: string; provider_payment_id: string | null; metadata?: Record<string, unknown> | null }[]
  shipments?: { id: number; status: string; delivery_method?: string | null; carrier: string | null; tracking_number: string | null; internal_tracking_id?: string | null; estimated_delivery_at?: string | null; shipped_at?: string | null; delivered_at?: string | null; metadata?: Record<string, unknown> | null; seller_order?: { seller?: { store_name: string } | null } | null; rider?: { name?: string | null } | null }[]
  refunds?: { id: number; status: string; amount_minor: number; currency: string; reason: string | null }[]
}

export interface AuditLog {
  id: number
  action: string
  resource_type: string | null
  resource_id: number | null
  ip_address: string | null
  before: Record<string, unknown> | null
  after: Record<string, unknown> | null
  created_at: string
  actor?: User
}

export interface Coupon {
  id: number
  code: string
  type: 'fixed' | 'percentage'
  value: number
  minimum_subtotal_minor: number
  maximum_discount_minor: number | null
  usage_limit: number | null
  usage_count: number
  per_user_limit: number
  starts_at: string | null
  ends_at: string | null
  is_active: boolean
}
