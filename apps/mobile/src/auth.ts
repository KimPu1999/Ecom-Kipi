import { create } from 'zustand'
import type { AuthUser } from '@kipi/types'

interface MobileAuthState {
  user: AuthUser | null
  token: string | null
  hydrated: boolean
  setSession: (user: AuthUser, token: string) => void
  setHydrated: (value: boolean) => void
  clear: () => void
}

export const useMobileAuth = create<MobileAuthState>((set) => ({
  user: null,
  token: null,
  hydrated: false,
  setSession: (user, token) => set({ user, token }),
  setHydrated: (hydrated) => set({ hydrated }),
  clear: () => set({ user: null, token: null }),
}))
