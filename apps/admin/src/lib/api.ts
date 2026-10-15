import { createApiClient } from '@kipi/api-client'
import { useAdminAuth } from '../store/auth'

export const api = createApiClient({
  baseURL: import.meta.env.VITE_ADMIN_API_URL ?? 'http://localhost:8000/api/v1',
  withCredentials: true,
  getToken: () => useAdminAuth.getState().token,
  clearToken: () => useAdminAuth.getState().clear(),
})
