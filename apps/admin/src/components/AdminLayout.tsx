import { useEffect, useState, type MouseEvent } from 'react'
import { Link, NavLink, Outlet, useLocation, useNavigate } from 'react-router-dom'
import { Boxes, ChevronDown, ChevronLeft, ChevronRight, CircleDollarSign, ClipboardList, FileBarChart, FileClock, LayoutDashboard, LogOut, Menu, Moon, Package, Percent, RotateCcw, Settings, ShieldCheck, ShoppingBag, Sun, Tags, Truck, Users, X } from 'lucide-react'
import { useAdminAuth } from '../store/auth'
import { api } from '../lib/api'

type NavItem = { label: string; to: string; icon: typeof LayoutDashboard; permission: string | null; superAdminOnly?: boolean }
type NavSection = { key: string; label: string; icon: typeof LayoutDashboard; items: NavItem[] }

const navSections: NavSection[] = [
  { key: 'dashboard', label: 'Dashboard', icon: LayoutDashboard, items: [{ label: 'Dashboard', to: '/admin', icon: LayoutDashboard, permission: null }] },
  { key: 'orders', label: 'Orders', icon: ClipboardList, items: [
    { label: 'All Orders', to: '/admin/orders', icon: ClipboardList, permission: 'manage_orders' },
    { label: 'Shipping', to: '/admin/shipping', icon: Truck, permission: 'manage_orders' },
  ] },
  { key: 'products', label: 'Products', icon: Package, items: [
    { label: 'All Products', to: '/admin/products', icon: Package, permission: 'manage_catalog' },
    { label: 'Categories', to: '/admin/categories', icon: Tags, permission: 'manage_catalog' },
    { label: 'Brands', to: '/admin/brands', icon: ShieldCheck, permission: 'manage_catalog' },
    { label: 'Coupons', to: '/admin/coupons', icon: Tags, permission: 'manage_catalog' },
    { label: 'Inventory', to: '/admin/inventory', icon: Boxes, permission: 'manage_inventory' },
  ] },
  { key: 'sellers', label: 'Sellers', icon: ShoppingBag, items: [
    { label: 'Seller Approvals', to: '/admin/marketplace', icon: ShieldCheck, permission: 'manage_marketplace', superAdminOnly: true },
    { label: 'All Sellers', to: '/admin/sellers', icon: ShoppingBag, permission: 'manage_marketplace', superAdminOnly: true },
  ] },
  { key: 'customers', label: 'Customers', icon: Users, items: [
    { label: 'All Customers', to: '/admin/users', icon: Users, permission: 'manage_users' },
  ] },
  { key: 'payments', label: 'Payments', icon: CircleDollarSign, items: [
    { label: 'Transactions', to: '/admin/payments', icon: CircleDollarSign, permission: 'manage_orders' },
    { label: 'Refunds', to: '/admin/refunds', icon: RotateCcw, permission: 'manage_orders' },
  ] },
  { key: 'commission', label: 'Commission', icon: Percent, items: [
    { label: 'Commission Settings', to: '/admin/settings', icon: Percent, permission: null, superAdminOnly: true },
  ] },
  { key: 'reports', label: 'Reports', icon: FileBarChart, items: [
    { label: 'Reports', to: '/admin/reports', icon: FileBarChart, permission: null },
  ] },
  { key: 'settings', label: 'Settings', icon: Settings, items: [
    { label: 'General Settings', to: '/admin/settings', icon: Settings, permission: null },
    { label: 'Audit Logs', to: '/admin/audit-logs', icon: FileClock, permission: 'view_audit_logs' },
  ] },
]

export function AdminLayout() {
  const [open, setOpen] = useState(false)
  const [collapsed, setCollapsed] = useState(false)
  const [openSection, setOpenSection] = useState<string | null>(null)
  const [flyout, setFlyout] = useState<{ key: string; top: number } | null>(null)
  const [dark, setDark] = useState(() => localStorage.getItem('kipi.admin.theme') === 'dark')
  const user = useAdminAuth((state) => state.user)
  const clear = useAdminAuth((state) => state.clear)
  const location = useLocation()
  const navigate = useNavigate()
  const isSuperAdmin = user?.roles?.includes('super_admin') ?? false
  const canViewItem = (item: NavItem) => (!item.superAdminOnly || isSuperAdmin) && (!item.permission || isSuperAdmin || user?.roles?.includes('admin'))
  const visibleSections = navSections.map((section) => ({ ...section, items: section.items.filter(canViewItem) })).filter((section) => section.items.length > 0)
  const isItemActive = (item: NavItem) => location.pathname === item.to || (item.to !== '/admin' && location.pathname.startsWith(item.to + '/'))
  const activeSectionKey = visibleSections.find((section) => section.items.some(isItemActive))?.key
  const current = visibleSections.flatMap((section) => section.items).find(isItemActive)

  useEffect(() => {
    document.documentElement.dataset.theme = dark ? 'dark' : 'light'
    localStorage.setItem('kipi.admin.theme', dark ? 'dark' : 'light')
  }, [dark])

  useEffect(() => {
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setOpen(false)
        setFlyout(null)
      }
    }
    window.addEventListener('keydown', closeOnEscape)
    return () => window.removeEventListener('keydown', closeOnEscape)
  }, [])

  useEffect(() => {
    setOpenSection(activeSectionKey && activeSectionKey !== 'dashboard' ? activeSectionKey : null)
    setFlyout(null)
  }, [activeSectionKey])

  useEffect(() => {
    const closeFlyoutOnOutsideClick = (event: globalThis.MouseEvent) => {
      const target = event.target
      if (target instanceof Element && !target.closest('.sidebar')) setFlyout(null)
    }
    document.addEventListener('mousedown', closeFlyoutOnOutsideClick)
    return () => document.removeEventListener('mousedown', closeFlyoutOnOutsideClick)
  }, [])

  function toggleSection(section: NavSection, event: MouseEvent<HTMLButtonElement>) {
    if (collapsed) {
      const trigger = event.currentTarget.getBoundingClientRect()
      const flyoutHeight = Math.min(420, section.items.length * 48 + 58)
      const top = Math.max(16, Math.min(trigger.top, window.innerHeight - flyoutHeight - 16))
      setOpenSection(null)
      setFlyout((currentFlyout) => currentFlyout?.key === section.key ? null : { key: section.key, top })
      return
    }
    setFlyout(null)
    setOpenSection((currentSection) => currentSection === section.key ? null : section.key)
  }

  function closeNavigation() {
    setOpen(false)
    setFlyout(null)
  }

  async function logout() {
    try {
      await api.auth.logout()
    } finally {
      clear()
      navigate('/admin/login')
    }
  }

  return <div className={'admin-shell ' + (collapsed ? 'sidebar-collapsed' : '')}>
    <div className={'mobile-backdrop ' + (open ? 'visible' : '')} onClick={() => setOpen(false)} />
    <aside className={'sidebar ' + (open ? 'open' : '')}>
      <div className="sidebar-top"><Link className="admin-brand" to="/admin" onClick={closeNavigation}><span className="brand-mark">K</span><span className="brand-name">Kipi <em>Control</em></span></Link><button className="icon-button mobile-close" onClick={closeNavigation} aria-label="Close navigation"><X size={20} /></button></div>
      <p className="sidebar-label">Navigation</p>
      <nav className="sidebar-nav" aria-label="Admin navigation">
        {visibleSections.map((section) => {
          const SectionIcon = section.icon
          const active = section.items.some(isItemActive)
          const expanded = openSection === section.key
          const isDashboard = section.key === 'dashboard'
          return <div className={'sidebar-nav-group ' + (active ? 'has-active' : '')} key={section.key}>
            {isDashboard ? <NavLink className="sidebar-nav-link sidebar-dashboard-link" title={collapsed ? section.label : undefined} aria-label={section.label} to={section.items[0].to} end onClick={closeNavigation}><SectionIcon size={24} /><span>{section.label}</span></NavLink> : <>
              <button className={'sidebar-section-toggle ' + (active ? 'active' : '')} title={collapsed ? section.label : undefined} aria-label={section.label} aria-expanded={collapsed ? flyout?.key === section.key : expanded} aria-controls={'sidebar-submenu-' + section.key} onClick={(event) => toggleSection(section, event)}><SectionIcon size={25} /><span>{section.label}</span><ChevronDown className={'sidebar-section-chevron ' + (expanded ? 'expanded' : '')} size={19} /></button>
              <div id={'sidebar-submenu-' + section.key} className={'sidebar-submenu ' + (expanded ? 'expanded' : '')} aria-hidden={!expanded}>{section.items.map((item) => { const ItemIcon = item.icon; return <NavLink className="sidebar-submenu-link" tabIndex={collapsed || !expanded ? -1 : 0} key={item.to} aria-label={item.label} to={item.to} end={item.to === '/admin'} onClick={closeNavigation}><ItemIcon size={18} /><span>{item.label}</span></NavLink> })}</div>
            </>}
          </div>
        })}
      </nav>
      {collapsed && flyout ? (() => { const section = visibleSections.find((item) => item.key === flyout.key); if (!section) return null; return <div className="sidebar-flyout" style={{ top: flyout.top }} role="menu" aria-label={section.label}><strong>{section.label}</strong>{section.items.map((item) => { const ItemIcon = item.icon; return <NavLink className="sidebar-flyout-link" role="menuitem" key={item.to} to={item.to} end={item.to === '/admin'} onClick={closeNavigation}><ItemIcon size={18} /><span>{item.label}</span></NavLink> })}</div> })() : null}
      <div className="sidebar-bottom"><div className="admin-mini"><span className="avatar">{user?.name?.slice(0, 1).toUpperCase()}</span><span><strong>{user?.name}</strong><small>{isSuperAdmin ? 'Super admin' : 'Administrator'}</small></span></div><button className="logout-link" onClick={logout}><LogOut size={17} />Log out</button></div>
      <button className="sidebar-collapse" onClick={() => { setCollapsed((value) => !value); setOpenSection(null); setFlyout(null) }} aria-label={collapsed ? 'Expand sidebar' : 'Collapse sidebar'} title={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}>{collapsed ? <ChevronRight size={16} /> : <ChevronLeft size={16} />}<span>{collapsed ? 'Expand' : 'Collapse'}</span></button>
    </aside>
    <main className="admin-main">
      <header className="topbar"><button className="icon-button mobile-menu" onClick={() => { setCollapsed(false); setOpen(true) }} aria-label="Open navigation" aria-expanded={open}><Menu size={21} /></button><div className="breadcrumbs"><span>Control center</span><b>/</b><strong>{current?.label ?? 'Page'}</strong></div><div className="topbar-actions"><button className="icon-button" onClick={() => setDark((value) => !value)} aria-label="Toggle theme">{dark ? <Sun size={18} /> : <Moon size={18} />}</button><div className="topbar-profile"><span className="avatar">{user?.name?.slice(0, 1).toUpperCase()}</span><span className="profile-copy"><strong>{user?.name}</strong><small>{user?.email}</small></span></div></div></header>
      <div className="admin-content"><Outlet /></div>
    </main>
  </div>
}
