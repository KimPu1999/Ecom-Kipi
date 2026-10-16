import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom'
import { AdminLayout } from './components/AdminLayout'
import { ProtectedRoute } from './components/ProtectedRoute'
import { Dashboard } from './pages/Dashboard'
import { Login } from './pages/Login'
import { NotFound, Unauthorized } from './pages/Utility'
import { BrandsPage, CategoriesPage, ProductsPage } from './pages/CatalogPages'
import { AuditLogsPage, InventoryPage, OrdersPage, SettingsPage, UsersPage } from './pages/OperationsPages'
import { MarketplacePage } from './pages/MarketplacePage'
import { SellersPage } from './pages/MarketplacePage'
import { PaymentsPage, RefundsPage, ReportsPage } from './pages/FinancePages'
import { CouponsPage } from './pages/CouponsPage'
import { ShippingPage } from './pages/ShippingPage'
import { LanguageProvider } from './store/language'
import './styles.css'

export function App() {
  return <LanguageProvider><BrowserRouter><Routes><Route path="/admin/login" element={<Login />} /><Route path="/admin/unauthorized" element={<Unauthorized />} /><Route element={<ProtectedRoute />}><Route element={<AdminLayout />}><Route path="/admin" element={<Dashboard />} /><Route path="/admin/marketplace" element={<MarketplacePage />} /><Route path="/admin/sellers" element={<SellersPage />} /><Route path="/admin/users" element={<UsersPage />} /><Route path="/admin/categories" element={<CategoriesPage />} /><Route path="/admin/brands" element={<BrandsPage />} /><Route path="/admin/products" element={<ProductsPage />} /><Route path="/admin/coupons" element={<CouponsPage />} /><Route path="/admin/inventory" element={<InventoryPage />} /><Route path="/admin/orders" element={<OrdersPage />} /><Route path="/admin/shipping" element={<ShippingPage />} /><Route path="/admin/payments" element={<PaymentsPage />} /><Route path="/admin/refunds" element={<RefundsPage />} /><Route path="/admin/reports" element={<ReportsPage />} /><Route path="/admin/audit-logs" element={<AuditLogsPage />} /><Route path="/admin/settings" element={<SettingsPage />} /></Route></Route><Route path="/" element={<Navigate to="/admin" replace />} /><Route path="*" element={<NotFound />} /></Routes></BrowserRouter></LanguageProvider>
}
