import { createApiClient } from '@kipi/api-client'
import { useSellerAuth } from './auth'

export const api = createApiClient({ baseURL: import.meta.env.VITE_SELLER_API_URL ?? 'http://localhost:8000/api/v1', withCredentials: true, getToken: () => useSellerAuth.getState().token, clearToken: () => useSellerAuth.getState().clear() })
export async function sellerRequest<T>(method: string, url: string, data?: unknown) {
  const response = await api.request<{ data: T }>({ method, url, data })
  return response.data.data
}
