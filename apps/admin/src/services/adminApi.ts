import type { AxiosRequestConfig } from 'axios'
import { api } from '../lib/api'
import type { AuditLog, Brand, Category, Coupon, DashboardData, InventoryRow, Order, Pagination, Product, User, Variant } from '../types/admin'

async function request<T>(config: AxiosRequestConfig): Promise<T> {
  const response = await api.request<{ data: T; meta?: Pagination<unknown>['meta'] }>(config)
  return response.data.meta ? ({ data: response.data.data, meta: response.data.meta } as T) : response.data.data
}

export const adminApi = {
  dashboard: (period = '30d') => request<DashboardData>({ url: '/admin/dashboard', params: { period } }),
  users: (params: Record<string, string> = {}) => request<Pagination<User>>({ url: '/admin/users', params }),
  updateUserStatus: (id: number, status: string) => request<User>({ url: '/admin/users/' + id + '/status', method: 'PATCH', data: { status } }),
  updateUserRoles: (id: number, roles: string[]) => request<User>({ url: '/admin/users/' + id + '/roles', method: 'PATCH', data: { roles } }),
  categories: (params: Record<string, string> = {}) => request<Pagination<Category>>({ url: '/admin/categories', params }),
  createCategory: (data: unknown) => request<Category>({ url: '/admin/categories', method: 'POST', data }),
  updateCategory: (id: number, data: unknown) => request<Category>({ url: '/admin/categories/' + id, method: 'PUT', data }),
  deleteCategory: (id: number) => request<null>({ url: '/admin/categories/' + id, method: 'DELETE' }),
  brands: (params: Record<string, string> = {}) => request<Pagination<Brand>>({ url: '/admin/brands', params }),
  createBrand: (data: unknown) => request<Brand>({ url: '/admin/brands', method: 'POST', data }),
  updateBrand: (id: number, data: unknown) => request<Brand>({ url: '/admin/brands/' + id, method: 'PUT', data }),
  deleteBrand: (id: number) => request<null>({ url: '/admin/brands/' + id, method: 'DELETE' }),
  products: (params: Record<string, string> = {}) => request<Pagination<Product>>({ url: '/admin/products', params }),
  createProduct: (data: unknown) => request<Product>({ url: '/admin/products', method: 'POST', data }),
  updateProduct: (id: number, data: unknown) => request<Product>({ url: '/admin/products/' + id, method: 'PUT', data }),
  archiveProduct: (id: number) => request<null>({ url: '/admin/products/' + id, method: 'DELETE' }),
  createImage: (productId: number, data: FormData) => request<unknown>({ url: '/admin/products/' + productId + '/images', method: 'POST', data }),
  deleteImage: (id: number) => request<null>({ url: '/admin/images/' + id, method: 'DELETE' }),
  createVariant: (productId: number, data: unknown) => request<Variant>({ url: '/admin/products/' + productId + '/variants', method: 'POST', data }),
  inventory: (params: Record<string, string> = {}) => request<Pagination<InventoryRow>>({ url: '/admin/inventory', params }),
  adjustInventory: (variantId: number, data: unknown) => request<InventoryRow>({ url: '/admin/variants/' + variantId + '/inventory/adjust', method: 'POST', data }),
  orders: (params: Record<string, string> = {}) => request<Pagination<Order>>({ url: '/admin/orders', params }),
  order: (id: number) => request<Order>({ url: '/admin/orders/' + id }),
  updateOrderStatus: (id: number, status: string, note?: string) => request<Order>({ url: '/admin/orders/' + id + '/status', method: 'PATCH', data: { status, note } }),
  addOrderNote: (id: number, note: string) => request<unknown>({ url: '/admin/orders/' + id + '/notes', method: 'POST', data: { note } }),
  createShipment: (id: number, data: unknown) => request<unknown>({ url: '/admin/orders/' + id + '/shipments', method: 'POST', data }),
  updateShipment: (id: number, data: unknown) => request<unknown>({ url: '/admin/shipments/' + id + '/status', method: 'PATCH', data }),
  carriers: (params: Record<string, string> = {}) => request<Pagination<{ id: number; name: string; code: string; type: string; tracking_url: string | null; is_active: boolean; sort_order: number }>>({ url: '/admin/shipping/carriers', params }),
  createCarrier: (data: unknown) => request<unknown>({ url: '/admin/shipping/carriers', method: 'POST', data }),
  updateCarrier: (id: number, data: unknown) => request<unknown>({ url: '/admin/shipping/carriers/' + id, method: 'PATCH', data }),
  riders: (params: Record<string, string> = {}) => request<Pagination<{ id: number; name: string; phone: string | null; status: string; seller?: { store_name: string } | null }>>({ url: '/admin/shipping/riders', params }),
  createRider: (data: unknown) => request<unknown>({ url: '/admin/shipping/riders', method: 'POST', data }),
  updateRider: (id: number, data: unknown) => request<unknown>({ url: '/admin/shipping/riders/' + id, method: 'PATCH', data }),
  refunds: (id: number) => request<unknown[]>({ url: '/admin/orders/' + id + '/refunds' }),
  createRefund: (id: number, data: unknown) => request<unknown>({ url: '/admin/orders/' + id + '/refunds', method: 'POST', data }),
  auditLogs: (params: Record<string, string> = {}) => request<Pagination<AuditLog>>({ url: '/admin/audit-logs', params }),
  sellers: (params: Record<string, string> = {}) => request<Pagination<{ id: number; store_name: string; slug: string; status: string; products_count?: number; orders_count?: number }>>({ url: '/admin/marketplace/sellers', params }),
  updateSellerStatus: (id: number, status: string) => request<unknown>({ url: '/admin/marketplace/sellers/' + id + '/status', method: 'PATCH', data: { status } }),
  commissionRules: () => request<Pagination<{ id: number; seller_id: number | null; seller?: { id: number; store_name: string }; percentage_bps: number; fixed_minor: number; currency: string; is_active: boolean }>>({ url: '/admin/marketplace/commission-rules' }),
  createCommissionRule: (data: unknown) => request<unknown>({ url: '/admin/marketplace/commission-rules', method: 'POST', data }),
  updateCommissionRule: (id: number, data: unknown) => request<unknown>({ url: '/admin/marketplace/commission-rules/' + id, method: 'PUT', data }),
  coupons: (params: Record<string, string> = {}) => request<Pagination<Coupon>>({ url: '/admin/coupons', params }),
  createCoupon: (data: unknown) => request<Coupon>({ url: '/admin/coupons', method: 'POST', data }),
  updateCoupon: (id: number, data: unknown) => request<Coupon>({ url: '/admin/coupons/' + id, method: 'PUT', data }),
  disableCoupon: (id: number) => request<null>({ url: '/admin/coupons/' + id, method: 'DELETE' }),
}
