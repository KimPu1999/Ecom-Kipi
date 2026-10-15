import { create } from 'zustand'
import type { AuthUser } from '@kipi/types'

interface SellerAuth { user: AuthUser | null; token: string | null; setSession: (user: AuthUser, token: string) => void; clear: () => void }
export const useSellerAuth = create<SellerAuth>((set) => ({
  user: JSON.parse(sessionStorage.getItem('kipi.seller.user') ?? 'null'),
  token: sessionStorage.getItem('kipi.seller.token'),
  setSession: (user, token) => { sessionStorage.setItem('kipi.seller.user', JSON.stringify(user)); sessionStorage.setItem('kipi.seller.token', token); set({ user, token }) },
  clear: () => { sessionStorage.removeItem('kipi.seller.user'); sessionStorage.removeItem('kipi.seller.token'); set({ user: null, token: null }) },
}))
