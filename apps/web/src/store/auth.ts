import { create } from 'zustand'
import type { AuthUser } from '@kipi/types'

interface AuthState {
  user: AuthUser | null
  token: string | null
  setSession: (user: AuthUser, token: string) => void
  clear: () => void
}

export const useAuthStore = create<AuthState>((set) => ({
  user: null,
  token: null,
  setSession: (user, token) => set({ user, token }),
  clear: () => set({ user: null, token: null }),
}))
