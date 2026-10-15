import * as SecureStore from 'expo-secure-store'
import { StripeProvider } from '@stripe/stripe-react-native'
import { useEffect, type PropsWithChildren } from 'react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { api } from './api'
import { useMobileAuth } from './auth'
import { registerPushNotifications } from './notifications'

const queryClient = new QueryClient({ defaultOptions: { queries: { staleTime: 30_000, retry: 1 } } })
const tokenKey = 'kipi.auth.token'

function AuthBootstrap({ children }: PropsWithChildren) {
  const setSession = useMobileAuth((state) => state.setSession)
  const clear = useMobileAuth((state) => state.clear)
  const setHydrated = useMobileAuth((state) => state.setHydrated)
  const user = useMobileAuth((state) => state.user)

  useEffect(() => {
    let active = true
    async function restore() {
      const token = await SecureStore.getItemAsync(tokenKey)
      if (token) {
        try {
          const response = await api.auth.me()
          if (active) setSession(response.data, token)
        } catch {
          await SecureStore.deleteItemAsync(tokenKey)
          if (active) clear()
        }
      }
      if (active) setHydrated(true)
    }
    restore()
    return () => { active = false }
  }, [clear, setHydrated, setSession])

  useEffect(() => {
    if (user) registerPushNotifications().catch(() => undefined)
  }, [user])

  return children
}

export function AppProviders({ children }: PropsWithChildren) {
  return <StripeProvider publishableKey={process.env.EXPO_PUBLIC_STRIPE_PUBLISHABLE_KEY ?? ''}><QueryClientProvider client={queryClient}><AuthBootstrap>{children}</AuthBootstrap></QueryClientProvider></StripeProvider>
}
