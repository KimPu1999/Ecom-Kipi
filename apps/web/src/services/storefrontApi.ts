import type { AxiosRequestConfig } from 'axios'
import { api } from '../lib/api'
import type { ApiResponse, AuthUser } from '@kipi/types'
import type { Address, Brand, Cart, Category, CheckoutPreview, NotificationItem, Order, Pagination, Payment, Product, ReviewResponse, SellerApplication, SellerSummary, Shipment, TrackingEvent } from '../types/storefront'

async function request<T>(config: AxiosRequestConfig): Promise<ApiResponse<T>> {
  const response = await api.request<ApiResponse<T>>(config)
  return response.data
}

async function page<T>(config: AxiosRequestConfig): Promise<Pagination<T>> {
  const response = await request<T[]>(config)
  return { data: response.data, meta: response.meta }
}

export const storefrontApi = {
  categories: () => request<Category[]>({ url: '/categories' }),
  brands: () => request<Brand[]>({ url: '/brands' }),
  products: (params: Record<string, string | number | undefined>) => page<Product>({ url: '/products', params }),
  featured: () => page<Product>({ url: '/products/featured' }),
  product: (slug: string) => request<Product>({ url: '/products/' + encodeURIComponent(slug) }),
  reviews: (productId: number, pageNumber = 1) => request<ReviewResponse>({ url: '/products/' + productId + '/reviews', params: { page: pageNumber } }),
  createReview: (productId: number, data: { rating: number; title?: string; body?: string }) => request<unknown>({ url: '/products/' + productId + '/reviews', method: 'POST', data }),
  stores: () => request<SellerSummary[]>({ url: '/stores' }),
  store: (slug: string, pageNumber = 1) => request<{ store: SellerSummary; products: Product[]; meta?: { current_page: number; last_page: number; total: number } }>({ url: '/stores/' + encodeURIComponent(slug), params: { page: pageNumber } }),
  cart: () => request<Cart>({ url: '/cart' }),
  wishlist: () => request<{ products: Product[]; product_ids: number[] }>({ url: '/wishlist' }),
  addWishlist: (productId: number) => request<null>({ url: '/wishlist/' + productId, method: 'POST' }),
  removeWishlist: (productId: number) => request<null>({ url: '/wishlist/' + productId, method: 'DELETE' }),
  addCartItem: (variant_id: number, quantity: number) => request<Cart>({ url: '/cart/items', method: 'POST', data: { variant_id, quantity } }),
  updateCartItem: (id: number, quantity: number) => request<Cart>({ url: '/cart/items/' + id, method: 'PATCH', data: { quantity } }),
  removeCartItem: (id: number) => request<Cart>({ url: '/cart/items/' + id, method: 'DELETE' }),
  profile: () => request<AuthUser>({ url: '/profile' }),
  updateProfile: (data: unknown) => request<AuthUser>({ url: '/profile', method: 'PUT', data }),
  addresses: () => request<Address[]>({ url: '/addresses' }),
  createAddress: (data: unknown) => request<Address>({ url: '/addresses', method: 'POST', data }),
  updateAddress: (id: number, data: unknown) => request<Address>({ url: '/addresses/' + id, method: 'PUT', data }),
  removeAddress: (id: number) => request<null>({ url: '/addresses/' + id, method: 'DELETE' }),
  orders: (pageNumber = 1, filters: Record<string, string | undefined> = {}) => page<Order>({ url: '/orders', params: { page: pageNumber, ...filters } }),
  cancelOrder: (id: number) => request<Order>({ url: '/orders/' + id + '/cancel', method: 'POST' }),
  retryPayment: (paymentId: number, idempotencyKey: string) => request<{ payment: Payment; attempt: unknown; client_secret: string | null }>({ url: '/payments/' + paymentId + '/retry', method: 'POST', data: { idempotency_key: idempotencyKey } }),
  order: (id: string) => request<Order>({ url: '/orders/' + encodeURIComponent(id) }),
  shipments: (orderId: string) => request<Shipment[]>({ url: '/orders/' + encodeURIComponent(orderId) + '/shipments' }),
  tracking: (shipmentId: number) => request<TrackingEvent[]>({ url: '/shipments/' + shipmentId + '/tracking' }),
  notifications: (pageNumber = 1) => page<NotificationItem>({ url: '/notifications', params: { page: pageNumber } }),
  markNotificationRead: (id: string) => request<NotificationItem>({ url: '/notifications/' + encodeURIComponent(id) + '/read', method: 'POST' }),
  markNotificationsRead: () => request<null>({ url: '/notifications/read-all', method: 'POST' }),
  sellerApplications: () => request<SellerApplication[]>({ url: '/seller/applications' }),
  submitSellerApplication: (data: FormData) => request<SellerApplication>({ url: '/seller/applications', method: 'POST', data }),
  shippingMethods: () => request<{ id: number; code: string; name: string; description: string | null; price_minor: number; currency: string }[]>({ url: '/shipping/methods' }),
  checkoutPreview: (shippingMethodId?: number, couponCode?: string) => request<CheckoutPreview>({ url: '/checkout/preview', method: 'POST', data: { ...(shippingMethodId ? { shipping_method_id: shippingMethodId } : {}), ...(couponCode ? { coupon_code: couponCode } : {}) } }),
  confirmCheckout: (data: unknown, idempotencyKey: string) => request<Order>({ url: '/checkout/confirm', method: 'POST', data, headers: { 'Idempotency-Key': idempotencyKey } }),
  initializePayment: (orderId: number, idempotencyKey: string) => request<{ payment: Payment; attempt: unknown; client_secret: string | null }>({ url: '/payments/initialize', method: 'POST', data: { order_id: orderId, idempotency_key: idempotencyKey } }),
  paymentStatus: (paymentId: number) => request<{ payment: Payment; order: Order }>({ url: '/payments/' + paymentId + '/status' }),
}
