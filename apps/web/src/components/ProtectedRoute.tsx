import { Navigate, Outlet, useLocation } from 'react-router-dom'
import { useAuthStore } from '../store/auth'

export function ProtectedRoute() {
  const user = useAuthStore((state) => state.user)
  const location = useLocation()
  return user ? <Outlet /> : <Navigate to={'/login?next=' + encodeURIComponent(location.pathname + location.search)} replace />
}
