import { create } from 'zustand'
import type { AuthUser } from '@kipi/types'

interface AdminAuthState {
  user: AuthUser | null
  token: string | null
  setSession: (user: AuthUser, token: string) => void
  clear: () => void
}

export const useAdminAuth = create<AdminAuthState>((set) => ({
  user: JSON.parse(sessionStorage.getItem('kipi.admin.user') ?? 'null'),
  token: sessionStorage.getItem('kipi.admin.token'),
  setSession: (user, token) => {
    sessionStorage.setItem('kipi.admin.user', JSON.stringify(user))
    sessionStorage.setItem('kipi.admin.token', token)
    set({ user, token })
  },
  clear: () => {
    sessionStorage.removeItem('kipi.admin.user')
    sessionStorage.removeItem('kipi.admin.token')
    set({ user: null, token: null })
  },
}))
