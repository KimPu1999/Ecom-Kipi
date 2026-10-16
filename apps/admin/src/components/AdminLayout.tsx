import { useEffect, useState } from 'react'
import { Link, NavLink, Outlet, useLocation, useNavigate } from 'react-router-dom'
import { Boxes, ChevronLeft, ChevronRight, CircleDollarSign, ClipboardList, FileBarChart, FileClock, LayoutDashboard, LogOut, Menu, Moon, Package, RotateCcw, Settings, ShieldCheck, ShoppingBag, Sun, Tags, Truck, Users, X } from 'lucide-react'
import { useAdminAuth } from '../store/auth'
import { api } from '../lib/api'

type NavItem = { label: string; to: string; icon: typeof LayoutDashboard; permission: string | null; section: string; superAdminOnly?: boolean }

const navItems: NavItem[] = [
  { label: 'Dashboard', to: '/admin', icon: LayoutDashboard, permission: null, section: 'Overview' },
  { label: 'Marketplace', to: '/admin/marketplace', icon: ShoppingBag, permission: 'manage_marketplace', section: 'Marketplace', superAdminOnly: true },
  { label: 'Sellers', to: '/admin/sellers', icon: ShoppingBag, permission: 'manage_marketplace', section: 'Marketplace', superAdminOnly: true },
  { label: 'Users', to: '/admin/users', icon: Users, permission: 'manage_users', section: 'Marketplace' },
  { label: 'Categories', to: '/admin/categories', icon: Tags, permission: 'manage_catalog', section: 'Catalog' },
  { label: 'Brands', to: '/admin/brands', icon: ShieldCheck, permission: 'manage_catalog', section: 'Catalog' },
  { label: 'Products', to: '/admin/products', icon: Package, permission: 'manage_catalog', section: 'Catalog' },
  { label: 'Coupons', to: '/admin/coupons', icon: Tags, permission: 'manage_catalog', section: 'Catalog' },
  { label: 'Inventory', to: '/admin/inventory', icon: Boxes, permission: 'manage_inventory', section: 'Catalog' },
  { label: 'Orders', to: '/admin/orders', icon: ClipboardList, permission: 'manage_orders', section: 'Operations' },
  { label: 'Shipping', to: '/admin/shipping', icon: Truck, permission: 'manage_orders', section: 'Operations' },
  { label: 'Payments', to: '/admin/payments', icon: CircleDollarSign, permission: 'manage_orders', section: 'Operations' },
  { label: 'Refunds', to: '/admin/refunds', icon: RotateCcw, permission: 'manage_orders', section: 'Operations' },
  { label: 'Reports', to: '/admin/reports', icon: FileBarChart, permission: null, section: 'System' },
  { label: 'Audit logs', to: '/admin/audit-logs', icon: FileClock, permission: 'view_audit_logs', section: 'System' },
  { label: 'Settings', to: '/admin/settings', icon: Settings, permission: null, section: 'System' },
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

  useEffect(() => {
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setOpen(false)
    }
    window.addEventListener('keydown', closeOnEscape)
    return () => window.removeEventListener('keydown', closeOnEscape)
  }, [])

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
      <div className="sidebar-top"><Link className="admin-brand" to="/admin" onClick={() => setOpen(false)}><span className="brand-mark">K</span><span className="brand-name">Kipi <em>Control</em></span></Link><button className="icon-button mobile-close" onClick={() => setOpen(false)} aria-label="Close navigation"><X size={20} /></button></div>
      <p className="sidebar-label">Navigation</p>
      <nav className="sidebar-nav" aria-label="Admin navigation">{visibleItems.map(({ label, to, icon: Icon, section }, index) => <div className="sidebar-nav-group" key={to}>{(index === 0 || visibleItems[index - 1].section !== section) && <p className="sidebar-section-label">{section}</p>}<NavLink title={collapsed ? label : undefined} aria-label={label} to={to} end={to === '/admin'} onClick={() => setOpen(false)}><Icon size={18} /><span>{label}</span></NavLink></div>)}</nav>
      <div className="sidebar-bottom"><div className="admin-mini"><span className="avatar">{user?.name?.slice(0, 1).toUpperCase()}</span><span><strong>{user?.name}</strong><small>{isSuperAdmin ? 'Super admin' : 'Administrator'}</small></span></div><button className="logout-link" onClick={logout}><LogOut size={17} />Log out</button></div>
      <button className="sidebar-collapse" onClick={() => setCollapsed((value) => !value)} aria-label={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}>{collapsed ? <ChevronRight size={16} /> : <ChevronLeft size={16} />}<span>{collapsed ? 'Expand' : 'Collapse'}</span></button>
    </aside>
    <main className="admin-main">
      <header className="topbar"><button className="icon-button mobile-menu" onClick={() => { setCollapsed(false); setOpen(true) }} aria-label="Open navigation" aria-expanded={open}><Menu size={21} /></button><div className="breadcrumbs"><span>Control center</span><b>/</b><strong>{current?.label ?? 'Page'}</strong></div><div className="topbar-actions"><button className="icon-button" onClick={() => setDark((value) => !value)} aria-label="Toggle theme">{dark ? <Sun size={18} /> : <Moon size={18} />}</button><div className="topbar-profile"><span className="avatar">{user?.name?.slice(0, 1).toUpperCase()}</span><span className="profile-copy"><strong>{user?.name}</strong><small>{user?.email}</small></span></div></div></header>
      <div className="admin-content"><Outlet /></div>
    </main>
  </div>
}
