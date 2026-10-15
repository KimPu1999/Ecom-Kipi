import { Navigate, Outlet } from 'react-router-dom'
import { useAdminAuth } from '../store/auth'

export function ProtectedRoute() {
  return useAdminAuth((state) => state.user) ? <Outlet /> : <Navigate to="/admin/login" replace />
}
