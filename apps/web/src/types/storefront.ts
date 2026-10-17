export interface Pagination<T> {
  data: T[]
  meta?: { current_page: number; per_page: number; last_page: number; total: number; summary?: OrderSummary }
}

export interface Category {
  id: number
  name: string
  slug: string
  description: string | null
  color: string | null
  is_active: boolean
}

export interface Brand {
  id: number
  name: string
  slug: string
}

export interface ProductImage {
  id: number
  url: string
  alt_text: string | null
  is_primary: boolean
  sort_order: number
}
export interface SellerSummary {
  id: number
  store_name: string
  slug: string
  description?: string | null
  logo_path?: string | null
  banner_path?: string | null
  support_email?: string | null
  support_phone?: string | null
  products_count?: number
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
  seller?: SellerSummary | null
  images?: ProductImage[]
  variants?: Variant[]
}

export interface Review {
  id: number
  rating: number
  title: string | null
  body: string | null
  published_at: string | null
  user?: { id: number; name: string }
}

export interface ReviewResponse {
  summary: { average_rating: number; review_count: number }
  reviews: Review[]
}

export interface CartItem {
  id: number
  quantity: number
  line_total_minor: number
  variant: Variant & { product: Pick<Product, 'id' | 'name' | 'slug'> & { variants?: Variant[] } }
}

export interface Cart {
  id: number
  items: CartItem[]
  subtotal_minor: number
  item_count: number
}

export interface Address {
  id: number
  label?: string | null
  recipient_name: string
  phone: string
  line1: string
  line2: string | null
  city: string
  state: string | null
  postal_code: string | null
  country: string
  is_default: boolean
}

export interface OrderItem {
  id: number
  product_name: string
  sku: string
  quantity: number
  unit_price_minor: number
  line_total_minor?: number
  attributes?: Record<string, string> | null
  seller?: SellerSummary | null
  product_image?: string | null
}

export interface ShippingMethod {
  id: number
  code: string
  name: string
  description: string | null
  price_minor: number
  currency: string
}

export interface Order {
  id: number
  order_number: string
  shipping_address?: Record<string, unknown>
  billing_address?: Record<string, unknown>
  subtotal_minor: number
  discount_minor: number
  shipping_minor: number
  tax_minor: number
  grand_total_minor: number
  currency: string
  payment_status: string
  fulfillment_status: string
  placed_at: string | null
  cancelled_at?: string | null
  items?: OrderItem[]
  payments?: Payment[]
  shipping_method?: ShippingMethod | null
  refunds?: { id: number; status: string; amount_minor: number; currency: string; reason: string | null }[]
  status_history?: { id: number; from_status: string | null; to_status: string; note: string | null; created_at: string }[]
  seller_orders?: { id: number; order_number: string; seller?: SellerSummary | null; status: string; fulfillment_status: string; items?: OrderItem[] }[]
  shipments?: Shipment[]
}

export interface OrderSummary {
  all: number
  pending: number
  confirmed: number
  processing: number
  shipped: number
  delivered: number
  cancelled: number
}

export interface CheckoutPreview {
  lines?: { name: string; sku: string; quantity: number; unit_price_minor: number; line_total_minor: number }[]
  shipping_method?: { id: number; code: string; name: string; price_minor: number; currency: string }
  subtotal_minor: number
  discount_minor: number
  shipping_minor: number
  tax_minor: number
  grand_total_minor: number
  currency: string
  item_count: number
  coupon_code?: string | null
}

export interface Payment {
  id: number
  order_id?: number
  provider: string
  provider_payment_id: string | null
  status: string
  amount_minor: number
  currency: string
  failure_message?: string | null
}

export interface Shipment {
  id: number
  status: string
  delivery_method?: 'self_delivery' | 'external_courier' | string | null
  carrier: string | null
  tracking_number: string | null
  internal_tracking_id?: string | null
  shipped_at?: string | null
  delivered_at?: string | null
  estimated_delivery_at?: string | null
  metadata?: { tracking_url?: string | null } | null
  method?: { name: string; code: string } | null
  seller_order?: { seller?: SellerSummary | null } | null
  rider?: { name: string; phone?: string | null } | null
  tracking?: TrackingEvent[]
  items?: { id: number; order_item_id: number; quantity: number }[]
}

export interface TrackingEvent {
  id: number
  status: string
  message: string | null
  location: string | null
  occurred_at: string
}

export interface NotificationItem {
  id: string
  type: string
  data: { event?: string; title?: string; body?: string; order_id?: number; shipment_id?: number }
  read_at: string | null
  created_at: string
}

export interface NotificationPreferences {
  order_updates: boolean
  payment_updates: boolean
  delivery_updates: boolean
}

export interface SellerApplication {
  id: number
  business_name: string
  business_type: string | null
  business_details: Record<string, unknown> | null
  contact_details: Record<string, unknown> | null
  application_status: string
  submitted_at: string | null
  reviewed_at: string | null
  rejection_reason: string | null
  documents?: { id: number; document_type: string; status: string }[]
  approval_history?: { id: number; action: string; from_status: string | null; to_status: string; reason: string | null; created_at: string }[]
}
