import type { Address, ApiResponse, AuthUser, Brand, Cart, Category, Order, Payment, Product, SellerSummary, Shipment, ShippingMethod } from '@kipi/types'
import { api } from './api'
import type { CheckoutPreview, MobileNotification, ShipmentTracking } from './types'

async function request<T>(config: Parameters<typeof api.request>[0]) {
  const response = await api.request<ApiResponse<T>>(config)
  return response.data
}

async function page<T>(config: Parameters<typeof api.request>[0]): Promise<{ data: T[]; meta?: import('@kipi/types').PaginationMeta }> {
  const response = await request<T[]>(config)
  return { data: response.data, meta: response.meta }
}

export const commerceApi = {
  categories: () => request<Category[]>({ url: '/categories' }),
  brands: () => request<Brand[]>({ url: '/brands' }),
  products: (params: Record<string, string | number | boolean | undefined>) => page<Product>({ url: '/products', params }),
  featured: () => page<Product>({ url: '/products/featured' }),
  product: (slug: string) => request<Product>({ url: '/products/' + encodeURIComponent(slug) }),
  stores: () => request<SellerSummary[]>({ url: '/stores' }),
  cart: () => request<Cart>({ url: '/cart' }),
  addCartItem: (variant_id: number, quantity: number) => request<Cart>({ url: '/cart/items', method: 'POST', data: { variant_id, quantity } }),
  updateCartItem: (id: number, quantity: number) => request<Cart>({ url: '/cart/items/' + id, method: 'PATCH', data: { quantity } }),
  removeCartItem: (id: number) => request<Cart>({ url: '/cart/items/' + id, method: 'DELETE' }),
  addresses: () => request<Address[]>({ url: '/addresses' }),
  createAddress: (data: unknown) => request<Address>({ url: '/addresses', method: 'POST', data }),
  updateAddress: (id: number, data: unknown) => request<Address>({ url: '/addresses/' + id, method: 'PUT', data }),
  removeAddress: (id: number) => request<null>({ url: '/addresses/' + id, method: 'DELETE' }),
  profile: () => request<AuthUser>({ url: '/profile' }),
  updateProfile: (data: unknown) => request<AuthUser>({ url: '/profile', method: 'PUT', data }),
  orders: (pageNumber = 1) => page<Order>({ url: '/orders', params: { page: pageNumber } }),
  order: (id: number) => request<Order>({ url: '/orders/' + id }),
  shipments: (id: number) => request<Shipment[]>({ url: '/orders/' + id + '/shipments' }),
  tracking: (id: number) => request<ShipmentTracking[]>({ url: '/shipments/' + id + '/tracking' }),
  shippingMethods: () => request<ShippingMethod[]>({ url: '/shipping/methods' }),
  checkoutPreview: (shippingMethodId?: number, couponCode?: string) => request<CheckoutPreview>({ url: '/checkout/preview', method: 'POST', data: { ...(shippingMethodId ? { shipping_method_id: shippingMethodId } : {}), ...(couponCode ? { coupon_code: couponCode } : {}) } }),
  confirmCheckout: (payload: unknown, idempotencyKey: string) => request<Order>({ url: '/checkout/confirm', method: 'POST', data: payload, headers: { 'Idempotency-Key': idempotencyKey } }),
  initializePayment: (orderId: number, idempotencyKey: string) => request<{ payment: Payment; client_secret: string | null }>({ url: '/payments/initialize', method: 'POST', data: { order_id: orderId, idempotency_key: idempotencyKey } }),
  paymentStatus: (paymentId: number) => request<{ payment: Payment; order: Order }>({ url: '/payments/' + paymentId + '/status' }),
  cancelOrder: (id: number) => request<Order>({ url: '/orders/' + id + '/cancel', method: 'POST' }),
  registerPushToken: (token: string, platform: string) => request<null>({ url: '/devices/push-tokens', method: 'POST', data: { token, platform } }),
  removePushToken: (token?: string) => request<null>({ url: '/devices/push-tokens', method: 'DELETE', data: token ? { token } : undefined }),
  notificationPreferences: () => request<Record<string, boolean>>({ url: '/notification-preferences' }),
  updateNotificationPreferences: (data: Record<string, boolean>) => request<Record<string, boolean>>({ url: '/notification-preferences', method: 'PUT', data }),
  notifications: (pageNumber = 1) => page<MobileNotification>({ url: '/notifications', params: { page: pageNumber } }),
  markNotificationsRead: () => request<null>({ url: '/notifications/read-all', method: 'POST' }),
}
