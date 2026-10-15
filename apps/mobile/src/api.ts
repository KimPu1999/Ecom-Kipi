import * as SecureStore from 'expo-secure-store'
import { createApiClient } from '@kipi/api-client'
import { useMobileAuth } from './auth'

const tokenKey = 'kipi.auth.token'

export const api = createApiClient({
  baseURL: process.env.EXPO_PUBLIC_API_URL ?? 'http://localhost:8000/api/v1',
  getToken: () => useMobileAuth.getState().token ?? SecureStore.getItemAsync(tokenKey),
  clearToken: async () => {
    useMobileAuth.getState().clear()
    await SecureStore.deleteItemAsync(tokenKey)
  },
})

export async function saveToken(token: string) {
  await SecureStore.setItemAsync(tokenKey, token)
}
