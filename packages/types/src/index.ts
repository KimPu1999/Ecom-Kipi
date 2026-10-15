export interface PaginationMeta {
  current_page: number
  per_page: number
  last_page: number
  total: number
}

export interface ApiResponse<T> {
  success: boolean
  message: string
  data: T
  meta?: PaginationMeta
}

export interface ApiError {
  success: false
  message: string
  errors?: Record<string, string[]>
}

export interface User {
  id: number
  name: string
  email: string
  phone: string | null
  status: string
  roles?: string[]
}

export type AuthUser = User

export interface AuthResponse {
  user: AuthUser
  token: string
  token_type: 'Bearer'
}

export interface Category { id: number; name: string; slug: string; description: string | null; is_active: boolean }
export interface Brand { id: number; name: string; slug: string }
export interface ProductImage { id: number; url: string; alt_text: string | null; is_primary: boolean; sort_order: number }
export interface SellerSummary { id: number; store_name: string; slug: string }
export interface ProductVariant { id: number; sku: string; price_minor: number; compare_at_price_minor: number | null; currency: string; attributes: Record<string, string> | null; is_active: boolean; available_quantity: number; product?: Pick<Product, 'id' | 'name' | 'slug'> }
export interface Product { id: number; name: string; slug: string; description: string | null; status: string; is_featured: boolean; category?: Category; brand?: Brand; seller?: SellerSummary | null; images?: ProductImage[]; variants?: ProductVariant[] }
export interface CartItem { id: number; quantity: number; line_total_minor: number; variant: ProductVariant & { product: Pick<Product, 'id' | 'name' | 'slug'> } }
export interface Cart { id: number; items: CartItem[]; subtotal_minor: number; item_count: number }
export interface Address { id: number; label?: string | null; recipient_name: string; phone: string; line1: string; line2: string | null; city: string; state: string | null; postal_code: string | null; country: string; is_default: boolean }
export interface OrderItem { id: number; product_name: string; sku: string; quantity: number; unit_price_minor: number; line_total_minor?: number; attributes?: Record<string, string> | null }
export interface Payment { id: number; order_id?: number; provider: string; provider_payment_id: string | null; status: string; amount_minor: number; currency: string; failure_message?: string | null }
export interface Shipment { id: number; status: string; carrier: string | null; tracking_number: string | null }
export interface SellerOrder { id: number; order_number: string; status: string; payment_status: string; fulfillment_status: string; subtotal_minor: number; shipping_minor: number; commission_minor: number; net_minor: number; currency: string; items?: OrderItem[] }
export interface Order { id: number; order_number: string; shipping_address?: Record<string, unknown>; billing_address?: Record<string, unknown>; subtotal_minor: number; discount_minor: number; shipping_minor: number; tax_minor: number; grand_total_minor: number; currency: string; payment_status: string; fulfillment_status: string; placed_at: string | null; cancelled_at?: string | null; items?: OrderItem[]; seller_orders?: SellerOrder[]; payments?: Payment[]; shipments?: Shipment[]; refunds?: { id: number; status: string; amount_minor: number; currency: string; reason: string | null }[]; status_history?: { id: number; from_status: string | null; to_status: string; note: string | null; created_at: string }[] }
export interface ShippingMethod { id: number; code: string; name: string; description: string | null; price_minor: number; currency: string }
export interface ApiPage<T> { data: T[]; meta?: PaginationMeta }
