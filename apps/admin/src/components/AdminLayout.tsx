import { useEffect, useState } from 'react'
import { Link, NavLink, Outlet, useLocation, useNavigate } from 'react-router-dom'
import { Boxes, ChevronLeft, ChevronRight, CircleDollarSign, ClipboardList, FileBarChart, FileClock, LayoutDashboard, LogOut, Menu, Moon, Package, RotateCcw, Settings, ShieldCheck, ShoppingBag, Sun, Tags, Users, X } from 'lucide-react'
import { useAdminAuth } from '../store/auth'
import { api } from '../lib/api'

type NavItem = { label: string; to: string; icon: typeof LayoutDashboard; permission: string | null; superAdminOnly?: boolean }

const navItems: NavItem[] = [
  { label: 'Dashboard', to: '/admin', icon: LayoutDashboard, permission: null },
  { label: 'Marketplace', to: '/admin/marketplace', icon: ShoppingBag, permission: 'manage_marketplace', superAdminOnly: true },
  { label: 'Sellers', to: '/admin/sellers', icon: ShoppingBag, permission: 'manage_marketplace', superAdminOnly: true },
  { label: 'Users', to: '/admin/users', icon: Users, permission: 'manage_users' },
  { label: 'Categories', to: '/admin/categories', icon: Tags, permission: 'manage_catalog' },
  { label: 'Brands', to: '/admin/brands', icon: ShieldCheck, permission: 'manage_catalog' },
  { label: 'Products', to: '/admin/products', icon: Package, permission: 'manage_catalog' },
  { label: 'Coupons', to: '/admin/coupons', icon: Tags, permission: 'manage_catalog' },
  { label: 'Inventory', to: '/admin/inventory', icon: Boxes, permission: 'manage_inventory' },
  { label: 'Orders', to: '/admin/orders', icon: ClipboardList, permission: 'manage_orders' },
  { label: 'Payments', to: '/admin/payments', icon: CircleDollarSign, permission: 'manage_orders' },
  { label: 'Refunds', to: '/admin/refunds', icon: RotateCcw, permission: 'manage_orders' },
  { label: 'Reports', to: '/admin/reports', icon: FileBarChart, permission: null },
  { label: 'Audit logs', to: '/admin/audit-logs', icon: FileClock, permission: 'view_audit_logs' },
  { label: 'Settings', to: '/admin/settings', icon: Settings, permission: null },
]

export function AdminLayout() {
  const [open, setOpen] = useState(false)
  const [collapsed, setCollapsed] = useState(false)
  const [dark, setDark] = useState(() => localStorage.getItem('kipi.admin.theme') === 'dark')
  const user = useAdminAuth((state) => state.user)
  const clear = useAdminAuth((state) => state.clear)
  const location = useLocation()
  const navigate = useNavigate()
  const isSuperAdmin = user?.roles?.includes('super_admin') ?? false
  const visibleItems = navItems.filter((item) => (!item.superAdminOnly || isSuperAdmin) && (!item.permission || isSuperAdmin || user?.roles?.includes('admin')))

  useEffect(() => {
    document.documentElement.dataset.theme = dark ? 'dark' : 'light'
    localStorage.setItem('kipi.admin.theme', dark ? 'dark' : 'light')
  }, [dark])

  async function logout() {
    try {
      await api.auth.logout()
    } finally {
      clear()
      navigate('/admin/login')
    }
  }

  const current = visibleItems.find((item) => location.pathname === item.to || (item.to !== '/admin' && location.pathname.startsWith(item.to)))

  return <div className={'admin-shell ' + (collapsed ? 'sidebar-collapsed' : '')}>
    <div className={'mobile-backdrop ' + (open ? 'visible' : '')} onClick={() => setOpen(false)} />
    <aside className={'sidebar ' + (open ? 'open' : '')}>
      <div className="sidebar-top"><Link className="admin-brand" to="/admin" onClick={() => setOpen(false)}><span className="brand-mark">K</span><span>Kipi <em>Control</em></span></Link><button className="icon-button mobile-close" onClick={() => setOpen(false)} aria-label="Close navigation"><X size={20} /></button></div>
      <p className="sidebar-label">Workspace</p>
      <nav className="sidebar-nav">{visibleItems.map(({ label, to, icon: Icon }) => <NavLink key={to} to={to} end={to === '/admin'} onClick={() => setOpen(false)}><Icon size={18} /><span>{label}</span></NavLink>)}</nav>
      <div className="sidebar-bottom"><div className="admin-mini"><span className="avatar">{user?.name?.slice(0, 1).toUpperCase()}</span><span><strong>{user?.name}</strong><small>{isSuperAdmin ? 'Super admin' : 'Administrator'}</small></span></div><button className="logout-link" onClick={logout}><LogOut size={17} />Log out</button></div>
      <button className="sidebar-collapse" onClick={() => setCollapsed((value) => !value)} aria-label={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}>{collapsed ? <ChevronRight size={16} /> : <ChevronLeft size={16} />}<span>{collapsed ? 'Expand' : 'Collapse'}</span></button>
    </aside>
    <main className="admin-main">
      <header className="topbar"><button className="icon-button mobile-menu" onClick={() => setOpen(true)} aria-label="Open navigation"><Menu size={21} /></button><div className="breadcrumbs"><span>Control center</span><b>/</b><strong>{current?.label ?? 'Page'}</strong></div><div className="topbar-actions"><button className="icon-button" onClick={() => setDark((value) => !value)} aria-label="Toggle theme">{dark ? <Sun size={18} /> : <Moon size={18} />}</button><div className="topbar-profile"><span className="avatar">{user?.name?.slice(0, 1).toUpperCase()}</span><span className="profile-copy"><strong>{user?.name}</strong><small>{user?.email}</small></span></div></div></header>
      <div className="admin-content"><Outlet /></div>
    </main>
  </div>
}
