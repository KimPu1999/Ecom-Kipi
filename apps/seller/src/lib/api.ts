import { createApiClient } from '@kipi/api-client'
import type { AxiosRequestConfig } from 'axios'
import { useSellerAuth } from './auth'

export const api = createApiClient({ baseURL: import.meta.env.VITE_SELLER_API_URL ?? 'http://localhost:8000/api/v1', withCredentials: true, getToken: () => useSellerAuth.getState().token, clearToken: () => useSellerAuth.getState().clear() })
export async function sellerRequest<T>(method: string, url: string, data?: unknown, config: Pick<AxiosRequestConfig, 'headers' | 'params'> = {}) {
  const response = await api.request<{ data: T }>({ method, url, data, ...config })
  return response.data.data
}

export async function sellerRequestWithMeta<T>(method: string, url: string, data?: unknown, config: Pick<AxiosRequestConfig, 'headers' | 'params'> = {}) {
  const response = await api.request<{ data: T; meta?: Record<string, number> }>({ method, url, data, ...config })

  return { data: response.data.data, meta: response.data.meta ?? {} }
}
