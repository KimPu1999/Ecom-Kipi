export type CheckoutPreview = {
  lines: Array<{ name: string; sku: string; quantity: number; unit_price_minor: number; line_total_minor: number }>
  shipping_method: import('@kipi/types').ShippingMethod
  subtotal_minor: number
  discount_minor: number
  shipping_minor: number
  tax_minor: number
  grand_total_minor: number
  currency: string
  item_count: number
  coupon_code?: string | null
}

export type ShipmentTracking = { id: number; status: string; location: string | null; message: string | null; occurred_at: string }

export type MobileNotification = { id: string; type: string; data: { title?: string; body?: string; order_id?: number }; read_at: string | null; created_at: string }
