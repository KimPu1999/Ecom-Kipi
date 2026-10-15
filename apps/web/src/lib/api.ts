import { createApiClient } from '@kipi/api-client'
import { useAuthStore } from '../store/auth'

export const api = createApiClient({
  baseURL: import.meta.env.VITE_API_URL ?? 'http://localhost:8000/api/v1',
  withCredentials: true,
  getToken: () => useAuthStore.getState().token,
  clearToken: () => useAuthStore.getState().clear(),
})
