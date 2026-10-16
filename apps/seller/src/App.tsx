import { useEffect, useRef, useState } from 'react'
import { BrowserRouter, Link, Navigate, NavLink, Outlet, Route, Routes, useLocation, useNavigate, useParams } from 'react-router-dom'
import { AlertTriangle, ArrowLeft, ArrowUpRight, BarChart3, Bell, Boxes, Check, ChevronDown, ChevronLeft, ChevronRight, CircleDollarSign, ClipboardList, Clock3, ImagePlus, LayoutDashboard, LogOut, Menu, PackageCheck, Pencil, Search, Settings, ShoppingBag, Star, Store, Trash2, TrendingUp, UploadCloud, Wallet, X } from 'lucide-react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { ApiClientError } from '@kipi/api-client'
import { LanguageSwitcher } from '../../../packages/i18n/src'
import { ThemeSwitcher } from './lib/theme'
import { loginSchema, type LoginInput } from '@kipi/validation'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { api, sellerRequest, sellerRequestWithMeta } from './lib/api'
import { useSellerAuth } from './lib/auth'
import './product-form.css'
import './seller-custom-layout.css'
import './shipment-workflow.css'
import './theme.css'
import { FulfillmentPage, ShipmentDetailsPage } from './pages/FulfillmentPages'
import { buildVariantCombinations, emptyVariant, MAX_PRODUCT_VARIANTS, mergeVariantRows, optionSuggestion, type ProductOptionDraft, type VariantDraft, validateProductOptions, validateVariantRows, variantLabel } from './product-variants'

type Seller = { id: number; store_name: string; slug: string; status: string }
type Dashboard = { seller: Seller; products: number; orders: number; earnings: { gross_minor: number; available_minor: number; total_sales_minor?: number; commission_deducted_minor?: number; net_earnings_minor?: number; pending_earnings_minor?: number; paid_earnings_minor?: number; refund_adjustments_minor?: number; currency: string } }
type DashboardView = 'daily' | 'weekly' | 'monthly'
type SellerDashboardMetrics = { total_sales_minor: number; total_orders: number; pending_orders: number; products: number; low_stock_products: number; out_of_stock_products: number; net_earnings_minor: number; commission_deducted_minor: number; pending_earnings_minor: number; paid_earnings_minor: number; refund_adjustments_minor: number; currency: string; awaiting_shipment: number; payment_issues: number }
type SellerDashboardOrder = { id: number; order_id: number; order_number: string; customer_name: string | null; created_at: string | null; subtotal_minor: number; currency: string; payment_status: string; fulfillment_status: string }
type SellerDashboardProduct = { product_id: number | null; name: string; image_url: string | null; quantity: number; revenue: number; currency: string }
type SellerDashboard = Dashboard & { metrics: SellerDashboardMetrics; range: { view: DashboardView; from: string; to: string }; sales_trend: { date: string; revenue: number; orders: number }[]; recent_orders: SellerDashboardOrder[]; top_products: SellerDashboardProduct[] }
type Product = { id: number; name: string; slug?: string; description?: string | null; status: string; average_rating?: number | null; review_count?: number | null; category?: { id: number; name: string }; brand?: { id: number; name: string }; images?: { id: number; url: string; alt_text: string | null; is_primary: boolean }[]; variants?: { id?: number; sku: string; price_minor: number; compare_at_price_minor?: number | null; attributes?: Record<string, string> | null; is_active?: boolean; quantity?: number; reserved_quantity?: number; low_stock_threshold?: number; available_quantity: number; currency?: string }[] }
type Category = { id: number; name: string; slug: string; description: string | null; is_active: boolean }
type Brand = { id: number; name: string; slug: string }
type NewProductValues = { category_id: number; brand_id?: number; name: string; slug: string; description?: string; status: 'draft' | 'published'; currency: string }
type SellerOrder = { id: number; order_number: string; status: string; payment_status?: string; fulfillment_status: string; subtotal_minor: number; commission_minor: number; net_minor: number; currency: string; order_id?: number; created_at?: string; items?: { id: number; product_name: string; sku: string; quantity: number; unit_price_minor: number; line_total_minor: number }[]; order?: { user?: { name?: string | null; email?: string | null } | null; placed_at?: string | null; shipping_address?: Record<string, unknown> | null }; shipments?: { id: number; status: string; carrier: string | null; tracking_number: string | null }[] }
type CommissionHistoryRow = { id: number; order_id: number; seller_order_id: number; order_number: string; brand: { id: number; name: string } | null; eligible_subtotal_minor: number; percentage_bps: number; fixed_minor: number; commission_minor: number; net_minor: number; currency: string; payment_status: string | null; payout_status: string | null; status: string; rule_source: string; confirmed_at: string | null; refund_adjustments_minor: number; commission_reversed_minor: number }
type SellerEarnings = { total_sales_minor: number; commission_deducted_minor: number; commission_refunds_minor: number; net_earnings_minor: number; pending_earnings_minor: number; paid_earnings_minor: number; refund_adjustments_minor: number; gross_minor: number; available_minor: number; currency: string; payout_processing_configured: boolean; commission_history: CommissionHistoryRow[] }
type NotificationPage = { read_at?: string | null }

function createProductOptionId(): string {
  return typeof crypto !== 'undefined' && 'randomUUID' in crypto ? crypto.randomUUID() : `option-${Date.now()}-${Math.random().toString(36).slice(2)}`
}

function Login() {
  const navigate = useNavigate(); const setSession = useSellerAuth((s) => s.setSession); const clear = useSellerAuth((s) => s.clear); const [error, setError] = useState('')
  const { register, handleSubmit, formState: { errors, isSubmitting } } = useForm<LoginInput>({ resolver: zodResolver(loginSchema) })
  async function submit(values: LoginInput) { setError(''); try { const result = await api.auth.login(values); setSession(result.data.user, result.data.token); try { await sellerRequest<Dashboard>('GET', '/seller/dashboard') } catch (sellerError) { clear(); throw sellerError } navigate('/seller') } catch (e) { setError(apiErrorMessage(e)) } }
  return <div className="login-page"><div className="login-panel"><span className="logo">K</span><span className="kicker">KIPI MARKETPLACE</span><h1>Your store, in focus.</h1><p>Manage products, inventory, fulfillment, earnings, and your seller team from one workspace.</p></div><form className="login-card" onSubmit={handleSubmit(submit)}><span className="kicker">Seller portal</span><h2>Welcome back</h2><p className="muted">Use your approved seller account to continue.</p>{error && <div className="error">{error}</div>}<label>Email<input type="email" placeholder="seller@example.com" {...register('email')} />{errors.email && <small>{errors.email.message}</small>}</label><label>Password<input type="password" placeholder="Your password" {...register('password')} />{errors.password && <small>{errors.password.message}</small>}</label><button className="primary" disabled={isSubmitting}>{isSubmitting ? 'Signing in…' : 'Sign in'}</button></form></div>
}

export function SellerProfileMenu({ user, onLogout }: { user: { name?: string | null; email?: string | null } | null; onLogout: () => Promise<void> }) {
  const [open, setOpen] = useState(false)
  const [loggingOut, setLoggingOut] = useState(false)
  const [error, setError] = useState('')
  const menuRef = useRef<HTMLDivElement>(null)
  const name = user?.name?.trim() || 'Seller'
  const initial = name.slice(0, 1).toUpperCase()

  useEffect(() => {
    const closeOnOutsideClick = (event: MouseEvent) => {
      if (!menuRef.current?.contains(event.target as Node)) setOpen(false)
    }
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setOpen(false)
    }
    document.addEventListener('mousedown', closeOnOutsideClick)
    document.addEventListener('keydown', closeOnEscape)
    return () => {
      document.removeEventListener('mousedown', closeOnOutsideClick)
      document.removeEventListener('keydown', closeOnEscape)
    }
  }, [])

  async function handleLogout() {
    if (loggingOut) return
    setError('')
    setLoggingOut(true)
    try {
      await onLogout()
    } catch (reason) {
      setLoggingOut(false)
      setError(apiErrorMessage(reason))
    }
  }

  return <div className="seller-profile-menu" ref={menuRef}>
    <button className="seller-profile-trigger" type="button" aria-label="Open profile menu" aria-expanded={open} aria-haspopup="menu" onClick={() => { setError(''); setOpen((value) => !value) }}>
      <span className="avatar" aria-hidden="true">{initial}</span>
      <span className="seller-profile-trigger-copy"><strong>{name}</strong><small>Seller account</small></span>
      <ChevronDown size={16} aria-hidden="true" />
    </button>
    {open ? <div className="seller-profile-dropdown" role="menu" aria-label="Profile menu">
      <div className="seller-profile-summary"><strong>{name}</strong><span>{user?.email || 'No email available'}</span></div>
      <div className="seller-profile-divider" />
      <Link className="seller-profile-menu-item" to="/seller/settings" role="menuitem" onClick={() => setOpen(false)}><Settings size={17} aria-hidden="true" /><span>Settings</span></Link>
      <button className="seller-profile-menu-item danger" type="button" role="menuitem" disabled={loggingOut} onClick={handleLogout}><LogOut size={17} aria-hidden="true" /><span>{loggingOut ? 'Signing out…' : 'Log out'}</span></button>
      {error ? <p className="seller-profile-error" role="alert">{error}</p> : null}
    </div> : null}
  </div>
}

function Layout() {
  const [open, setOpen] = useState(false); const [collapsed, setCollapsed] = useState(false); const navigate = useNavigate(); const location = useLocation(); const clear = useSellerAuth((s) => s.clear); const user = useSellerAuth((s) => s.user)
  const notifications = useQuery({ queryKey: ['seller-notifications'], queryFn: () => sellerRequestWithMeta<NotificationPage[]>('GET', '/notifications', undefined, { params: { per_page: 20 } }) })
  const logout = async () => { await api.auth.logout(); clear(); navigate('/seller/login', { replace: true }) }
  const items = [["Overview", "/seller", LayoutDashboard], ["Products", "/seller/products", Store], ["Inventory", "/seller/inventory", Boxes], ["Orders", "/seller/orders", ClipboardList], ["Fulfillment", "/seller/fulfillment", ClipboardList], ["Earnings", "/seller/earnings", BarChart3], ["Payouts", "/seller/payouts", Wallet]] as const
  const pageTitle = location.pathname.startsWith('/seller/products') ? 'Product Management' : 'Seller workspace'
  const unreadCount = notifications.data?.meta.unread_count ?? 0
  return <div className={'shell ' + (collapsed ? 'sidebar-collapsed' : '')}><aside className={'sidebar ' + (open ? 'open' : '')}><div className="brand"><span className="logo small">K</span><span>Kipi <em>Seller</em></span><button className="icon mobile" onClick={() => setOpen(false)} aria-label="Close navigation"><X size={19} /></button></div><p className="nav-label">Workspace</p><div className="sidebar-navigation"><nav>{items.map(([label, to, Icon]) => <NavLink key={to} to={to} end={to === '/seller'} onClick={() => setOpen(false)} aria-label={label} title={collapsed ? label : undefined}><Icon size={20} strokeWidth={2} aria-hidden="true" /><span className="nav-item-label">{label}</span></NavLink>)}</nav></div><footer className="sidebar-footer"><button className="sidebar-collapse" type="button" onClick={() => setCollapsed((value) => !value)} aria-label={collapsed ? 'Expand sidebar' : 'Collapse sidebar'} title={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}>{collapsed ? <ChevronRight size={16} /> : <ChevronLeft size={16} />}<span>{collapsed ? 'Expand sidebar' : 'Collapse sidebar'}</span></button></footer></aside>{open ? <button className="sidebar-backdrop" type="button" aria-label="Close navigation" onClick={() => setOpen(false)} /> : null}<main className="main"><header className="seller-header"><div className="header-title-group"><button className="icon mobile-menu" onClick={() => setOpen(true)} aria-label="Open navigation"><Menu size={21} /></button><div><span className="kicker">SELLER WORKSPACE</span><strong>{pageTitle}</strong></div></div><div className="header-actions"><label className="header-search"><Search size={16} /><span className="visually-hidden">Search seller products</span><input placeholder="Search products" aria-label="Search seller products" onKeyDown={(event) => { if (event.key === 'Enter') navigate(`/seller/products?q=${encodeURIComponent(event.currentTarget.value.trim())}`) }} /></label><button className="header-icon" aria-label={`Notifications${unreadCount ? `, ${unreadCount} unread` : ''}`}><Bell size={18} />{unreadCount > 0 ? <span className="notification-badge">{unreadCount > 99 ? '99+' : unreadCount}</span> : null}</button><ThemeSwitcher /><LanguageSwitcher /><SellerProfileMenu user={user} onLogout={logout} /><Link className="store-link" to="/" target="_blank"><Store size={17} />Open storefront</Link></div></header><section className="content"><Outlet /></section></main></div>
}

function Protected() { return useSellerAuth((s) => s.user) ? <Outlet /> : <Navigate to="/seller/login" replace /> }
const money = (value: number, currency = 'MMK') => new Intl.NumberFormat('en-US', { style: 'currency', currency, maximumFractionDigits: 0 }).format(value)
function apiErrorMessage(error: unknown) { if (error instanceof ApiClientError) { const details = Object.values(error.errors ?? {}).flat().join(' '); return details ? error.message + ': ' + details : error.message } return error instanceof Error ? error.message : 'Something went wrong. Please try again.' }

function formatDashboardDate(value: string | null, view: DashboardView = 'daily') {
  if (!value) return '—'
  const date = new Date(`${value}T00:00:00`)
  if (Number.isNaN(date.getTime())) return value
  return new Intl.DateTimeFormat('en-US', { month: view === 'monthly' ? 'short' : 'short', day: view === 'monthly' ? undefined : 'numeric', year: view === 'monthly' ? 'numeric' : undefined }).format(date)
}

function dashboardStatusClass(value: string) {
  return value.toLowerCase().replace(/[^a-z0-9]+/g, '-')
}

function DashboardStat({ label, value, hint, to, icon }: { label: string; value: string; hint?: string; to: string; icon: React.ReactNode }) {
  return <Link className="stat card dashboard-stat-link" to={to}><span className="stat-icon">{icon}</span><span className="dashboard-stat-copy"><small>{label}</small><strong>{value}</strong>{hint ? <em>{hint}</em> : null}</span><ArrowUpRight className="dashboard-stat-arrow" size={16} aria-hidden="true" /></Link>
}

function SalesTrendChart({ points, view, isFetching, onViewChange }: { points: SellerDashboard['sales_trend']; view: DashboardView; isFetching: boolean; onViewChange: (view: DashboardView) => void }) {
  const hasSales = points.some((point) => point.revenue > 0)
  const left = 28
  const right = 700
  const top = 16
  const bottom = 170
  const max = Math.max(...points.map((point) => point.revenue), 1)
  const coordinates = points.map((point, index) => {
    const x = points.length === 1 ? left : left + (index / (points.length - 1)) * (right - left)
    const y = bottom - (point.revenue / max) * (bottom - top)
    return { ...point, x, y }
  })
  const line = coordinates.map((point) => `${point.x},${point.y}`).join(' ')
  const area = `${left},${bottom} ${line} ${right},${bottom}`

  return <section className="card overview-panel overview-sales-panel">
    <div className="overview-panel-heading"><div><span className="kicker">VERIFIED SALES</span><h2>Sales trend</h2><p>Sales recorded after verified payment.</p></div><label className="overview-view-select"><span className="visually-hidden">Sales trend view</span><select value={view} onChange={(event) => onViewChange(event.target.value as DashboardView)}><option value="daily">Daily</option><option value="weekly">Weekly</option><option value="monthly">Monthly</option></select></label></div>
    {isFetching ? <span className="overview-updating" role="status">Updating…</span> : null}
    {hasSales ? <div className="seller-sales-chart" aria-label="Seller sales trend chart" role="img"><svg viewBox="0 0 728 196" preserveAspectRatio="none" aria-hidden="true"><line x1={left} x2={right} y1={top} y2={top} /><line x1={left} x2={right} y1={(top + bottom) / 2} y2={(top + bottom) / 2} /><line x1={left} x2={right} y1={bottom} y2={bottom} /><polygon points={area} /><polyline points={line} />{coordinates.map((point) => <circle key={point.date} cx={point.x} cy={point.y} r="3"><title>{`${formatDashboardDate(point.date, view)}: ${money(point.revenue)}`}</title></circle>)}</svg><div className="seller-sales-labels">{points.map((point) => <span key={point.date}>{formatDashboardDate(point.date, view)}</span>)}</div></div> : <Empty text="No verified sales in this period." />}
  </section>
}

function Overview() {
  const [view, setView] = useState<DashboardView>('daily')
  const query = useQuery({ queryKey: ['seller-dashboard', view], queryFn: () => sellerRequest<SellerDashboard>('GET', '/seller/dashboard', undefined, { params: { view } }), placeholderData: (previous) => previous })
  if (query.isPending && !query.data) return <Loading />
  if (!query.data) return <ErrorBox message={apiErrorMessage(query.error ?? new Error('Unable to load dashboard'))} />
  const data = query.data
  const metrics = data.metrics
  const alerts: { count: number; label: string; to: string; icon: React.ReactNode }[] = []
  if (metrics.pending_orders) alerts.push({ count: metrics.pending_orders, label: 'pending orders need attention', to: '/seller/orders', icon: <Clock3 size={17} /> })
  if (metrics.awaiting_shipment) alerts.push({ count: metrics.awaiting_shipment, label: 'paid orders await shipment', to: '/seller/fulfillment', icon: <PackageCheck size={17} /> })
  if (metrics.low_stock_products) alerts.push({ count: metrics.low_stock_products, label: 'products are low in stock', to: '/seller/inventory', icon: <Boxes size={17} /> })
  if (metrics.out_of_stock_products) alerts.push({ count: metrics.out_of_stock_products, label: 'products are out of stock', to: '/seller/inventory', icon: <AlertTriangle size={17} /> })
  if (metrics.payment_issues) alerts.push({ count: metrics.payment_issues, label: 'orders have payment issues', to: '/seller/orders', icon: <CircleDollarSign size={17} /> })

  return <div className="seller-overview">
    <div className="overview-heading"><div><span className="kicker">SELLER OVERVIEW</span><h1>{data.seller.store_name}</h1><p>Monitor your store, verified earnings, orders, and inventory from one place.</p></div><Link className="button primary" to="/seller/products/new"><ShoppingBag size={15} /> Add product</Link></div>
    {query.isError ? <div className="overview-feedback error block" role="alert"><span>Unable to refresh this dashboard view. Showing the last successful data.</span><button className="text-link" type="button" onClick={() => query.refetch()}>Retry</button></div> : null}
    <div className="overview-stat-grid">
      <DashboardStat label="Total sales" value={money(metrics.total_sales_minor, metrics.currency)} hint="Verified payment sales" to="/seller/earnings" icon={<TrendingUp size={18} />} />
      <DashboardStat label="Total orders" value={metrics.total_orders.toLocaleString()} hint="Seller orders" to="/seller/orders" icon={<ClipboardList size={18} />} />
      <DashboardStat label="Pending orders" value={metrics.pending_orders.toLocaleString()} hint="Needs attention" to="/seller/orders" icon={<Clock3 size={18} />} />
      <DashboardStat label="Products" value={metrics.products.toLocaleString()} hint="Your catalog" to="/seller/products" icon={<Store size={18} />} />
      <DashboardStat label="Low / out of stock" value={`${metrics.low_stock_products} / ${metrics.out_of_stock_products}`} hint="Low / unavailable" to="/seller/inventory" icon={<Boxes size={18} />} />
      <DashboardStat label="Net earnings" value={money(metrics.net_earnings_minor, metrics.currency)} hint="After commission" to="/seller/earnings" icon={<Wallet size={18} />} />
    </div>
    <div className="overview-main-grid"><SalesTrendChart points={data.sales_trend} view={view} isFetching={query.isFetching} onViewChange={setView} /><section className="card overview-panel overview-earnings-panel"><div className="overview-panel-heading"><div><span className="kicker">EARNINGS</span><h2>Financial summary</h2><p>Server-calculated seller balances.</p></div><Link className="text-link" to="/seller/earnings">View earnings</Link></div><dl className="overview-earnings-list"><div><dt>Gross sales</dt><dd>{money(metrics.total_sales_minor, metrics.currency)}</dd></div><div><dt>Commission deducted</dt><dd>{money(metrics.commission_deducted_minor, metrics.currency)}</dd></div><div><dt>Net earnings</dt><dd>{money(metrics.net_earnings_minor, metrics.currency)}</dd></div><div><dt>Pending earnings</dt><dd>{money(metrics.pending_earnings_minor, metrics.currency)}</dd></div><div><dt>Paid earnings</dt><dd>{money(metrics.paid_earnings_minor, metrics.currency)}</dd></div></dl></section></div>
    <div className="overview-lower-grid"><section className="card overview-panel"><div className="overview-panel-heading"><div><span className="kicker">ORDER ACTIVITY</span><h2>Recent orders</h2><p>Your latest seller orders.</p></div><Link className="text-link" to="/seller/orders">View all</Link></div>{data.recent_orders.length ? <div className="overview-table-scroll"><table className="overview-table"><thead><tr><th>Order</th><th>Customer</th><th>Date</th><th>Total</th><th>Payment</th><th>Status</th><th /></tr></thead><tbody>{data.recent_orders.map((order) => <tr key={order.id}><td><strong>{order.order_number}</strong></td><td>{order.customer_name ?? 'Customer'}</td><td>{formatDashboardDate(order.created_at)}</td><td>{money(order.subtotal_minor, order.currency)}</td><td><span className={`overview-status ${dashboardStatusClass(order.payment_status)}`}>{productStatusLabel(order.payment_status)}</span></td><td><span className={`overview-status ${dashboardStatusClass(order.fulfillment_status)}`}>{productStatusLabel(order.fulfillment_status)}</span></td><td><Link className="text-link" to={`/seller/orders/${order.id}`}>View details</Link></td></tr>)}</tbody></table></div> : <Empty text="No seller orders yet." />}</section><section className="card overview-panel"><div className="overview-panel-heading"><div><span className="kicker">CATALOG PERFORMANCE</span><h2>Top products</h2><p>Paid units sold across your catalog.</p></div><Link className="text-link" to="/seller/products">Catalog</Link></div>{data.top_products.length ? <div className="overview-product-list">{data.top_products.map((product) => <div className="overview-product-row" key={`${product.product_id ?? product.name}-${product.quantity}`}><div className="overview-product-image">{product.image_url ? <img src={product.image_url} alt="" loading="lazy" /> : <ShoppingBag size={18} />}</div><div><strong>{product.name}</strong><small>{product.quantity.toLocaleString()} units · {money(product.revenue, product.currency)}</small></div></div>)}</div> : <Empty text="Top products will appear after verified sales." />}</section></div>
    <section className="card overview-panel overview-alerts-panel"><div className="overview-panel-heading"><div><span className="kicker">ACTION REQUIRED</span><h2>Store alerts</h2><p>Open the relevant workspace to resolve an issue.</p></div></div>{alerts.length ? <div className="overview-alert-list">{alerts.map((alert) => <Link className="overview-alert" to={alert.to} key={alert.label}><span className="overview-alert-icon">{alert.icon}</span><span><strong>{alert.count.toLocaleString()}</strong> {alert.label}</span><ArrowUpRight size={16} aria-hidden="true" /></Link>)}</div> : <Empty text="No action required right now." />}</section>
  </div>
}

function productStock(product: Product) {
  const variants = (product.variants ?? []).filter((variant) => variant.is_active !== false)
  const available = variants.reduce((total, variant) => total + Math.max(0, Number(variant.available_quantity ?? 0)), 0)
  const lowStockThreshold = variants.reduce((threshold, variant) => Math.max(threshold, Number(variant.low_stock_threshold ?? 5)), 0)
  if (available === 0) return { available, label: 'Out of stock', tone: 'out' }
  if (available <= lowStockThreshold) return { available, label: 'Limited', tone: 'limited' }
  return { available, label: 'In stock', tone: 'in' }
}

function productPrice(product: Product) {
  const variants = (product.variants ?? []).filter((variant) => variant.is_active !== false)
  if (!variants.length) return '—'
  const prices = variants.map((variant) => Number(variant.price_minor)).sort((a, b) => a - b)
  const currency = variants[0]?.currency ?? 'MMK'
  return prices[0] === prices[prices.length - 1] ? money(prices[0], currency) : `${money(prices[0], currency)} – ${money(prices[prices.length - 1], currency)}`
}

function productStatusLabel(status: string) {
  return status.replace(/[_-]+/g, ' ').replace(/\b\w/g, (letter) => letter.toUpperCase())
}

function productPages(current: number, last: number): Array<number | 'ellipsis'> {
  if (last <= 1) return [1]
  const pages = new Set<number>([1, last, current, current - 1, current + 1])
  const visible = [...pages].filter((page) => page > 0 && page <= last).sort((a, b) => a - b)
  return visible.reduce<Array<number | 'ellipsis'>>((items, page, index) => {
    if (index > 0 && page - visible[index - 1] > 1) items.push('ellipsis')
    items.push(page)
    return items
  }, [])
}

function Products() {
  const client = useQueryClient()
  const location = useLocation()
  const [search, setSearch] = useState('')
  const [debouncedSearch, setDebouncedSearch] = useState('')
  const [status, setStatus] = useState('')
  const [categoryId, setCategoryId] = useState('')
  const [stockStatus, setStockStatus] = useState('')
  const [sort, setSort] = useState('latest')
  const [page, setPage] = useState(1)
  const [success, setSuccess] = useState('')
  const categories = useQuery({ queryKey: ['seller-product-categories'], queryFn: () => sellerRequest<Category[]>('GET', '/categories') })
  const query = useQuery({
    queryKey: ['seller-products', { q: debouncedSearch, status, categoryId, stockStatus, sort, page }],
    queryFn: () => sellerRequestWithMeta<Product[]>('GET', '/seller/products', undefined, { params: { q: debouncedSearch || undefined, status: status || undefined, category_id: categoryId || undefined, stock_status: stockStatus || undefined, sort, page, per_page: 10 } }),
    placeholderData: (previous) => previous,
  })
  const remove = useMutation({
    mutationFn: (id: number) => sellerRequest('DELETE', `/seller/products/${id}`),
    onSuccess: () => { setSuccess('Product deleted successfully.'); client.invalidateQueries({ queryKey: ['seller-products'] }) },
  })
  const urlSearch = new URLSearchParams(location.search).get('q') ?? ''
  useEffect(() => { setSearch(urlSearch) }, [urlSearch])
  useEffect(() => { const timer = window.setTimeout(() => setDebouncedSearch(search.trim()), 300); return () => window.clearTimeout(timer) }, [search])
  useEffect(() => { setPage(1) }, [debouncedSearch, status, categoryId, stockStatus, sort])

  if (query.isLoading && !query.data) return <Loading />
  const products = query.data?.data ?? []
  const currentPage = query.data?.meta.current_page ?? page
  const lastPage = query.data?.meta.last_page ?? 1
  const total = query.data?.meta.total ?? products.length

  return <div className="product-management-page">
    {query.error ? <ErrorBox message={apiErrorMessage(query.error)} /> : null}
    {remove.error ? <ErrorBox message={apiErrorMessage(remove.error)} /> : null}
    {success ? <div className="product-feedback success"><Check size={16} /> {success}</div> : null}
    <section className="card product-listing-card">
      <div className="product-listing-toolbar"><div><h2>Product Listing</h2><p>{total} product{total === 1 ? '' : 's'} in your catalog</p></div><div className="product-listing-controls"><label><span className="visually-hidden">Filter product status</span><select value={status} onChange={(event) => setStatus(event.target.value)}><option value="">All status</option><option value="published">Published</option><option value="draft">Draft</option></select></label><label><span className="visually-hidden">Filter product category</span><select value={categoryId} onChange={(event) => setCategoryId(event.target.value)}><option value="">All categories</option>{(categories.data ?? []).filter((category) => category.is_active).map((category) => <option value={category.id} key={category.id}>{category.name}</option>)}</select></label><label><span className="visually-hidden">Filter stock status</span><select value={stockStatus} onChange={(event) => setStockStatus(event.target.value)}><option value="">All stock</option><option value="in_stock">In stock</option><option value="limited">Limited</option><option value="out_of_stock">Out of stock</option></select></label><label><span className="visually-hidden">Sort products</span><select value={sort} onChange={(event) => setSort(event.target.value)}><option value="latest">Newest first</option><option value="name">Name A–Z</option><option value="name_desc">Name Z–A</option><option value="price_asc">Price low–high</option><option value="price_desc">Price high–low</option></select></label><Link className="button primary compact-button" to="/seller/products/new"><Store size={15} /> Add Product</Link></div></div>
      {query.isFetching ? <div className="product-loading-line" role="status">Updating product listing…</div> : null}
      <div className="product-table-scroll"><table className="product-management-table"><thead><tr><th>Product Image</th><th>Product Name</th><th>Category</th><th>Stock</th><th>Price</th><th>Status</th><th>Reviews</th><th>Action</th></tr></thead><tbody>{products.map((product) => { const stock = productStock(product); const image = product.images?.find((item) => item.is_primary) ?? product.images?.[0]; const sku = product.variants?.find((variant) => variant.is_active !== false)?.sku; return <tr key={product.id}><td><div className="product-thumbnail">{image ? <img src={image.url} alt={image.alt_text || product.name} loading="lazy" /> : <Store size={19} />}</div></td><td><div className="product-name-cell"><strong>{product.name}</strong><small>{sku ? `SKU ${sku}` : 'SKU unavailable'}</small></div></td><td><span className="product-category">{product.category?.name ?? 'Uncategorized'}</span></td><td><div className="product-stock-cell"><strong>{stock.available}</strong><span className={`stock-badge stock-${stock.tone}`}>{stock.label}</span></div></td><td><strong className="product-price">{productPrice(product)}</strong></td><td><span className={`product-status status-${product.status}`}>{productStatusLabel(product.status)}</span></td><td>{product.review_count && product.average_rating ? <span className="product-rating"><Star size={14} fill="currentColor" /> {product.average_rating.toFixed(1)} <small>({product.review_count})</small></span> : <span className="product-no-reviews">No reviews</span>}</td><td><span className="row-actions"><Link className="icon" title="Edit product" aria-label={`Edit ${product.name}`} to={`/seller/products/${product.id}/edit`}><Pencil size={16} /></Link><button className="icon danger" title="Delete product" aria-label={`Delete ${product.name}`} disabled={remove.isPending} onClick={() => { if (window.confirm(`Delete ${product.name}?`)) { setSuccess(''); remove.mutate(product.id) } }}><Trash2 size={16} /></button></span></td></tr> })}</tbody></table></div>
      {!products.length && !query.isFetching ? <Empty text={debouncedSearch || status || categoryId || stockStatus ? 'No products match the selected filters.' : 'No products yet. Add your first product to start selling.'} /> : null}
      {lastPage > 1 ? <nav className="product-pagination" aria-label="Product pages"><button className="pagination-button" disabled={currentPage <= 1} onClick={() => setPage((value) => Math.max(1, value - 1))}><ChevronLeft size={16} /> Previous</button><span className="pagination-pages">{productPages(currentPage, lastPage).map((item, index) => item === 'ellipsis' ? <span key={`ellipsis-${index}`} className="pagination-ellipsis">…</span> : <button key={item} className={item === currentPage ? 'pagination-page active' : 'pagination-page'} aria-current={item === currentPage ? 'page' : undefined} onClick={() => setPage(item)}>{item}</button>)}</span><button className="pagination-button" disabled={currentPage >= lastPage} onClick={() => setPage((value) => Math.min(lastPage, value + 1))}>Next <ChevronRight size={16} /></button></nav> : null}
    </section>
  </div>
}
function NewProduct() {
  const navigate = useNavigate()
  const client = useQueryClient()
  const [imageFiles, setImageFiles] = useState<File[]>([])
  const [imagePreviews, setImagePreviews] = useState<string[]>([])
  const [imageUrl, setImageUrl] = useState('')
  const [altText, setAltText] = useState('')
  const [mediaError, setMediaError] = useState('')
  const [hasVariants, setHasVariants] = useState(false)
  const [options, setOptions] = useState<ProductOptionDraft[]>([])
  const [rows, setRows] = useState<VariantDraft[]>([emptyVariant()])
  const categories = useQuery({ queryKey: ['seller-categories'], queryFn: () => sellerRequest<Category[]>('GET', '/categories') })
  const brands = useQuery({ queryKey: ['seller-brands'], queryFn: () => sellerRequest<Brand[]>('GET', '/brands') })
  const combinations = buildVariantCombinations(options)
  const combinationSignature = combinations.map((combination) => combination.key).join('\u0001')

  useEffect(() => {
    if (!hasVariants) {
      setRows((previous) => [previous[0] ?? emptyVariant()])
      return
    }

    setRows((previous) => mergeVariantRows(combinations, previous))
  }, [combinationSignature, hasVariants])

  useEffect(() => () => imagePreviews.forEach((preview) => URL.revokeObjectURL(preview)), [imagePreviews])

  const updateVariant = (index: number, patch: Partial<VariantDraft>) => setRows((previous) => previous.map((row, rowIndex) => rowIndex === index ? { ...row, ...patch } : row))
  const updateOption = (index: number, patch: Partial<ProductOptionDraft>) => setOptions((previous) => previous.map((option, optionIndex) => optionIndex === index ? { ...option, ...patch } : option))
  const addOption = () => setOptions((previous) => [...previous, { id: createProductOptionId(), name: '', values: [''] }])
  const removeOption = (index: number) => setOptions((previous) => previous.filter((_, optionIndex) => optionIndex !== index))
  const addOptionValue = (index: number) => setOptions((previous) => previous.map((option, optionIndex) => optionIndex === index ? { ...option, values: [...option.values, ''] } : option))
  const updateOptionValue = (optionIndex: number, valueIndex: number, value: string) => setOptions((previous) => previous.map((option, currentOptionIndex) => currentOptionIndex === optionIndex ? { ...option, values: option.values.map((item, currentValueIndex) => currentValueIndex === valueIndex ? value : item) } : option))
  const removeOptionValue = (optionIndex: number, valueIndex: number) => setOptions((previous) => previous.map((option, currentOptionIndex) => currentOptionIndex === optionIndex ? { ...option, values: option.values.filter((_, currentValueIndex) => currentValueIndex !== valueIndex) } : option))
  const applyOptionSuggestion = (index: number, suggestion: string) => {
    if (!suggestion) return
    setOptions((previous) => previous.map((option, optionIndex) => optionIndex === index ? { ...option, name: suggestion, values: optionSuggestion(suggestion) } : option))
  }

  const chooseImages = (files: File[]) => {
    imagePreviews.forEach((preview) => URL.revokeObjectURL(preview))
    const supported = files.filter((file) => ['image/jpeg', 'image/png', 'image/webp'].includes(file.type) && file.size <= 2 * 1024 * 1024)
    setMediaError(supported.length === files.length ? '' : 'Only JPG, PNG, or WebP images up to 2 MB are allowed.')
    setImageFiles(supported)
    setImagePreviews(supported.map((file) => URL.createObjectURL(file)))
  }

  const removeImage = (index: number) => {
    URL.revokeObjectURL(imagePreviews[index])
    setImageFiles((previous) => previous.filter((_, fileIndex) => fileIndex !== index))
    setImagePreviews((previous) => previous.filter((_, fileIndex) => fileIndex !== index))
  }

  const save = useMutation({
    mutationFn: async (value: NewProductValues) => {
      const draftRows = hasVariants ? rows : [rows[0] ?? emptyVariant()]
      const optionError = hasVariants ? validateProductOptions(options) : null
      if (optionError) throw new Error(optionError)
      const variantError = validateVariantRows(draftRows, hasVariants, combinations.length)
      if (variantError) throw new Error(variantError)

      const product = await sellerRequest<{ id: number }>('POST', '/seller/products', {
        category_id: value.category_id,
        brand_id: Number.isFinite(value.brand_id) ? value.brand_id : undefined,
        name: value.name.trim(),
        slug: value.slug.trim().toLowerCase(),
        description: value.description?.trim() || undefined,
        status: 'draft',
        variants: draftRows.filter((row) => row.is_active).map((row) => ({
          sku: row.sku.trim(),
          price_minor: Number(row.price_minor),
          compare_at_price_minor: row.compare_at_price_minor.trim() ? Number(row.compare_at_price_minor) : undefined,
          currency: value.currency.toUpperCase(),
          attributes: row.attributes,
          quantity: Number(row.quantity),
          is_active: true,
        })),
      })
      try {
        if (imageUrl.trim()) {
          const media = new FormData()
          media.append('url', imageUrl.trim())
          media.append('alt_text', altText.trim())
          media.append('sort_order', '0')
          media.append('is_primary', imageFiles.length ? '0' : '1')
          await sellerRequest('POST', '/seller/products/' + product.id + '/images', media)
        }
        for (const [index, file] of imageFiles.entries()) {
          const media = new FormData()
          media.append('file', file)
          media.append('alt_text', altText.trim())
          media.append('sort_order', String(index + (imageUrl.trim() ? 1 : 0)))
          media.append('is_primary', !imageUrl.trim() && index === 0 ? '1' : '0')
          await sellerRequest('POST', '/seller/products/' + product.id + '/images', media)
        }
        if (value.status === 'published') await sellerRequest('PATCH', '/seller/products/' + product.id, { status: 'published' })
      } catch (error) {
        throw new Error('Product was created as a draft, but setup failed: ' + apiErrorMessage(error))
      }
      return product
    },
    onSuccess: () => { client.invalidateQueries({ queryKey: ['seller-products'] }); client.invalidateQueries({ queryKey: ['seller-inventory'] }); navigate('/seller/products') },
  })
  const { register, handleSubmit, formState: { errors, isSubmitting } } = useForm<NewProductValues>({ defaultValues: { status: 'draft', currency: 'MMK' } })
  const displayRows = hasVariants ? rows : [rows[0] ?? emptyVariant()]
  const optionError = hasVariants ? validateProductOptions(options) : null
  if (categories.isLoading || brands.isLoading) return <Loading />
  if (categories.error || brands.error) return <ErrorBox message={apiErrorMessage(categories.error ?? brands.error ?? new Error('Unable to load product options'))} />
  return <div className="product-create-page">
    <div className="product-create-topbar">
      <Link className="product-back-link" to="/seller/products"><ArrowLeft size={16} /> Back to products</Link>
      <div className="product-create-meta"><span className="draft-badge">Draft</span><span className="product-save-status"><span /> Autosave is off</span></div>
    </div>
    <form className="product-editor" onSubmit={handleSubmit((value) => save.mutate(value))}>
      <div className="product-editor-main">
        <section className="product-panel">
          <div className="product-panel-heading"><span className="section-number">01</span><div><h2>Product information</h2><p>Give customers the essential details they need to understand this product.</p></div></div>
          <div className="product-form-grid product-form-grid--two">
            <label>Product name<input {...register('name', { required: 'Product name is required', maxLength: { value: 180, message: 'Use 180 characters or fewer' } })} placeholder="Everyday product" />{errors.name && <small>{errors.name.message}</small>}</label>
            <label>URL slug<input {...register('slug', { required: 'URL slug is required', pattern: { value: /^[a-z0-9]+(?:-[a-z0-9]+)*$/, message: 'Use lowercase letters, numbers, and hyphens' } })} placeholder="everyday-product" />{errors.slug && <small>{errors.slug.message}</small>}</label>
          </div>
          <label>Description<textarea rows={6} {...register('description')} placeholder="Describe the product, its materials, benefits, and what makes it special." /></label>
          <div className="product-form-grid product-form-grid--two">
            <label>Category<select {...register('category_id', { required: 'Choose a category', valueAsNumber: true })}><option value="">Choose a category</option>{(categories.data ?? []).filter((category) => category.is_active).map((category) => <option value={category.id} key={category.id}>{category.name}</option>)}</select>{errors.category_id && <small>{errors.category_id.message}</small>}</label>
            <label>Brand <span className="label-hint">Optional</span><select {...register('brand_id', { valueAsNumber: true })}><option value="">No brand</option>{(brands.data ?? []).map((brand) => <option value={brand.id} key={brand.id}>{brand.name}</option>)}</select></label>
          </div>
        </section>

        <section className="product-panel">
          <div className="product-panel-heading"><span className="section-number">02</span><div><h2>Pricing, inventory, and variants</h2><p>Use one sellable variant or generate combinations such as Black / M.</p></div></div>
          <label className="variant-toggle"><input type="checkbox" checked={hasVariants} onChange={(event) => setHasVariants(event.target.checked)} /><span><strong>This product has variants</strong><small>Enable this for size, color, storage, material, or other options.</small></span></label>
          <div className="product-form-grid product-form-grid--three"><label>Currency <span className="label-hint">3-letter code</span><input maxLength={3} {...register('currency', { required: 'Currency is required', minLength: { value: 3, message: 'Use a 3-letter currency code' }, maxLength: { value: 3, message: 'Use a 3-letter currency code' } })} /></label><div className="inventory-overview variant-count"><div><span className="inventory-kicker">Sellable inventory</span><strong>{displayRows.filter((row) => row.is_active).reduce((total, row) => total + (Number(row.quantity) || 0), 0).toLocaleString()} units</strong></div><span className="inventory-badge">{displayRows.filter((row) => row.is_active).length} active</span></div></div>
          {hasVariants ? <div className="option-builder"><div className="option-builder-heading"><div><strong>Product options</strong><p>Add option names and values. Values are customizable suggestions, not fixed category rules.</p></div><button type="button" className="button compact-button" onClick={addOption}>+ Add option</button></div>{options.map((option, optionIndex) => <div className="option-editor" key={option.id}><div className="option-editor-top"><label>Option name<input value={option.name} onChange={(event) => updateOption(optionIndex, { name: event.target.value })} placeholder="Size, Color, Storage" /></label><label>Suggestions<select value="" onChange={(event) => applyOptionSuggestion(optionIndex, event.target.value)}><option value="">Choose a suggestion</option><option value="Size">Clothing sizes</option><option value="Shoe size">Shoe sizes</option><option value="Color">Colors</option><option value="Storage">Storage capacities</option><option value="Material">Materials</option></select></label><button type="button" className="text-link danger-link" onClick={() => removeOption(optionIndex)}>Remove option</button></div><div className="option-values"><span className="option-values-label">Values</span>{option.values.map((value, valueIndex) => <div className="option-value" key={`${option.id}-${valueIndex}`}><input value={value} onChange={(event) => updateOptionValue(optionIndex, valueIndex, event.target.value)} placeholder="Enter a value" /><button type="button" className="icon danger" aria-label={`Remove option value ${value || valueIndex + 1}`} onClick={() => removeOptionValue(optionIndex, valueIndex)}><X size={15} /></button></div>)}<button type="button" className="text-link" onClick={() => addOptionValue(optionIndex)}>+ Add value</button></div></div>)}{!options.length ? <div className="option-empty">Add an option to generate variant combinations.</div> : null}{optionError ? <div className="variant-warning" role="alert">{optionError}</div> : null}{combinations.length > MAX_PRODUCT_VARIANTS ? <div className="variant-warning" role="alert">This selection would create {combinations.length} combinations. Reduce it to {MAX_PRODUCT_VARIANTS} or fewer before saving.</div> : null}</div> : null}
          {hasVariants && !combinations.length ? <div className="variant-empty">Add an option name and at least one value to build the variant table.</div> : null}
          {displayRows.length && (!hasVariants || combinations.length) ? <div className="variant-table-scroll"><table className="variant-builder-table"><thead><tr><th>Variant</th><th>SKU</th><th>Price</th><th>Compare-at</th><th>Stock</th><th>Sell</th></tr></thead><tbody>{displayRows.map((row, index) => <tr key={row.key}><td><strong>{variantLabel(row)}</strong><small>{Object.entries(row.attributes).map(([name, value]) => `${name}: ${value}`).join(' · ') || 'Base product variant'}</small></td><td><input value={row.sku} onChange={(event) => updateVariant(index, { sku: event.target.value })} placeholder="SKU-001" aria-label={`SKU for ${variantLabel(row)}`} /></td><td><input type="number" min="0" inputMode="numeric" value={row.price_minor} onChange={(event) => updateVariant(index, { price_minor: event.target.value })} placeholder="25000" aria-label={`Price for ${variantLabel(row)}`} /></td><td><input type="number" min="0" inputMode="numeric" value={row.compare_at_price_minor} onChange={(event) => updateVariant(index, { compare_at_price_minor: event.target.value })} placeholder="Optional" aria-label={`Compare-at price for ${variantLabel(row)}`} /></td><td><input type="number" min="0" inputMode="numeric" value={row.quantity} onChange={(event) => updateVariant(index, { quantity: event.target.value })} placeholder="0" aria-label={`Stock quantity for ${variantLabel(row)}`} /></td><td><label className="variant-active-toggle"><input type="checkbox" checked={row.is_active} onChange={(event) => updateVariant(index, { is_active: event.target.checked })} aria-label={`Sell ${variantLabel(row)}`} /><span>{row.is_active ? 'Active' : 'Excluded'}</span></label></td></tr>)}</tbody></table></div> : null}
        </section>

        <section className="product-panel">
          <div className="product-panel-heading"><span className="section-number">03</span><div><h2>Product media</h2><p>Upload a clear product image or add an image URL from your media provider.</p></div></div>
          <div className="media-layout">
            <label className="upload-zone"><input className="visually-hidden" type="file" accept="image/jpeg,image/png,image/webp" multiple onChange={(event) => chooseImages(Array.from(event.target.files ?? []))} /><span className="upload-icon"><UploadCloud size={24} /></span><strong>{imageFiles.length ? `${imageFiles.length} image(s) selected` : 'Choose images to upload'}</strong><small>JPG, PNG, or WebP · Maximum 2 MB each</small><span className="upload-button">Browse files</span></label>
            <div className="media-fields"><label>Image URL <span className="label-hint">Optional</span><input type="url" value={imageUrl} onChange={(event) => setImageUrl(event.target.value)} placeholder="https://cdn.example.com/product.webp" /></label><label>Alt text <span className="label-hint">Recommended</span><input value={altText} onChange={(event) => setAltText(event.target.value)} placeholder="Describe the product image" maxLength={255} /></label><small className="field-note"><ImagePlus size={14} /> Images help customers make confident buying decisions.</small></div>
          </div>
          {mediaError ? <div className="product-editor-error"><ErrorBox message={mediaError} /></div> : null}
          {(imagePreviews.length || imageUrl) ? <div className="product-image-preview-grid">{imagePreviews.map((preview, index) => <div className="product-image-preview" key={preview}><img src={preview} alt={altText || `Product preview ${index + 1}`} /><div><strong>{index === 0 && !imageUrl ? 'Primary image' : 'Gallery image'}</strong><small>{imageFiles[index]?.name}</small></div><button type="button" className="remove-image" onClick={() => removeImage(index)}>Remove</button></div>)}{imageUrl ? <div className="product-image-preview"><img src={imageUrl} alt={altText || 'Product preview'} /><div><strong>{imageFiles.length ? 'Gallery image' : 'Primary image'}</strong><small>{imageUrl}</small></div><button type="button" className="remove-image" onClick={() => setImageUrl('')}>Remove</button></div> : null}</div> : null}
        </section>
      </div>

      <aside className="product-editor-side">
        <section className="product-panel publish-panel"><div className="product-panel-heading"><span className="section-number">04</span><div><h2>Publishing</h2><p>Choose when customers can see this product.</p></div></div><label>Status<select {...register('status')}><option value="draft">Draft</option><option value="published">Publish after setup</option></select></label><div className="publish-note"><strong>Safe publishing</strong><p>Product and active variants are validated by the server before they are saved.</p></div></section>
        <section className="product-panel checklist-panel"><h3>Before you publish</h3><ul><li>Product name and description are clear</li><li>Price and stock quantity are accurate</li><li>SKU is unique for this product</li><li>Primary image is ready</li></ul></section>
      </aside>

      {save.error && <div className="product-editor-error"><ErrorBox message={apiErrorMessage(save.error)} /></div>}
      <div className="product-editor-actions"><Link className="button" to="/seller/products">Cancel</Link><div><span className="action-note">You can edit this product later.</span><button className="button primary" disabled={isSubmitting || save.isPending || (hasVariants && combinations.length > MAX_PRODUCT_VARIANTS)}>{save.isPending ? 'Creating product…' : 'Create product'}</button></div></div>
    </form>
  </div>
}
function LegacyEditProduct() {
  const { id = '' } = useParams()
  const navigate = useNavigate()
  const client = useQueryClient()
  const product = useQuery({ queryKey: ['seller-product', id], queryFn: () => sellerRequest<Product>('GET', `/seller/products/${id}`), enabled: Boolean(id) })
  const categories = useQuery({ queryKey: ['seller-categories'], queryFn: () => sellerRequest<Category[]>('GET', '/categories') })
  const brands = useQuery({ queryKey: ['seller-brands'], queryFn: () => sellerRequest<Brand[]>('GET', '/brands') })
  const [imageFile, setImageFile] = useState<File | null>(null)
  const [imageUrl, setImageUrl] = useState('')
  const [altText, setAltText] = useState('')
  const save = useMutation({
    mutationFn: async (value: { category_id: number; brand_id?: number; name: string; slug: string; description?: string; status: 'draft' | 'published' }) => {
      const updated = await sellerRequest<Product>('PUT', `/seller/products/${id}`, { ...value, brand_id: Number.isFinite(value.brand_id) ? value.brand_id : undefined, name: value.name.trim(), slug: value.slug.trim().toLowerCase(), description: value.description?.trim() || undefined })
      if (imageFile || imageUrl.trim()) {
        const media = new FormData()
        if (imageFile) media.append('file', imageFile)
        else media.append('url', imageUrl.trim())
        media.append('alt_text', altText.trim())
        media.append('is_primary', '1')
        await sellerRequest('POST', `/seller/products/${id}/images`, media)
      }
      return updated
    },
    onSuccess: () => { client.invalidateQueries({ queryKey: ['seller-products'] }); client.invalidateQueries({ queryKey: ['seller-product', id] }); navigate('/seller/products') },
  })
  const { register, handleSubmit, reset, formState: { errors, isSubmitting } } = useForm<{ category_id: number; brand_id?: number; name: string; slug: string; description?: string; status: 'draft' | 'published' }>({ defaultValues: { status: 'draft' } })
  useEffect(() => { if (product.data) { reset({ category_id: product.data.category?.id ?? 0, brand_id: product.data.brand?.id, name: product.data.name, slug: product.data.slug ?? '', description: product.data.description ?? '', status: product.data.status === 'published' ? 'published' : 'draft' }); const image = product.data.images?.find((item) => item.is_primary) ?? product.data.images?.[0]; setImageUrl(image?.url ?? ''); setAltText(image?.alt_text ?? '') } }, [product.data, reset])
  if (product.isLoading || categories.isLoading || brands.isLoading) return <Loading />
  if (product.error) return <ErrorBox message={apiErrorMessage(product.error)} />
  if (!product.data) return <ErrorBox message="Product not found." />
  const variant = product.data.variants?.[0]
  return <><PageTitle title="Edit product" subtitle="Update product information and replace the primary image. Price and stock are managed from the variant inventory workflow." /><form className="card form-card" onSubmit={handleSubmit((value) => save.mutate(value))}><div className="form-section"><span className="kicker">Product details</span><div className="form-grid"><label>Product name<input {...register('name', { required: 'Product name is required' })} />{errors.name && <small>{errors.name.message}</small>}</label><label>URL slug<input {...register('slug', { required: 'URL slug is required', pattern: { value: /^[a-z0-9]+(?:-[a-z0-9]+)*$/, message: 'Use lowercase letters, numbers, and hyphens' } })} />{errors.slug && <small>{errors.slug.message}</small>}</label><label>Category<select {...register('category_id', { required: 'Choose a category', valueAsNumber: true })}><option value="">Choose a category</option>{(categories.data ?? []).filter((category) => category.is_active).map((category) => <option value={category.id} key={category.id}>{category.name}</option>)}</select>{errors.category_id && <small>{errors.category_id.message}</small>}</label><label>Brand (optional)<select {...register('brand_id', { valueAsNumber: true })}><option value="">No brand</option>{(brands.data ?? []).map((brand) => <option value={brand.id} key={brand.id}>{brand.name}</option>)}</select></label></div><label>Description<textarea rows={5} {...register('description')} /></label></div><div className="form-section"><span className="kicker">Current variant</span><p className="muted">{variant ? `${variant.sku} · ${money(variant.price_minor, variant.currency)} · ${variant.available_quantity} available` : 'No variant created yet.'}</p></div><div className="form-section"><span className="kicker">Replace primary image (optional)</span><label>Upload image<input type="file" accept="image/jpeg,image/png,image/webp" onChange={(event) => { setImageFile(event.target.files?.[0] ?? null); setImageUrl('') }} /><small>JPG, PNG, or WebP. Maximum 2 MB.</small></label><label>Or use image URL<input type="url" value={imageUrl} onChange={(event) => { setImageUrl(event.target.value); setImageFile(null) }} /></label><label>Alt text<input value={altText} onChange={(event) => setAltText(event.target.value)} maxLength={255} /></label></div>{save.error && <ErrorBox message={apiErrorMessage(save.error)} />}<div className="form-actions"><Link className="button" to="/seller/products">Cancel</Link><button className="button primary" disabled={isSubmitting || save.isPending}>{save.isPending ? 'Saving product…' : 'Save product'}</button></div></form></>
}
function EditProduct() {
  const { id = '' } = useParams(); const client = useQueryClient()
  const product = useQuery({ queryKey: ['seller-product', id], queryFn: () => sellerRequest<Product>('GET', `/seller/products/${id}`), enabled: Boolean(id) })
  const categories = useQuery({ queryKey: ['seller-categories'], queryFn: () => sellerRequest<Category[]>('GET', '/categories') })
  const brands = useQuery({ queryKey: ['seller-brands'], queryFn: () => sellerRequest<Brand[]>('GET', '/brands') })
  const [form, setForm] = useState({ name: '', slug: '', description: '', category_id: '', brand_id: '', status: 'draft' }); const [rows, setRows] = useState<Product['variants']>([]); const [files, setFiles] = useState<File[]>([]); const [error, setError] = useState(''); const [saved, setSaved] = useState(false)
  useEffect(() => { if (!product.data) return; setForm({ name: product.data.name, slug: product.data.slug ?? '', description: product.data.description ?? '', category_id: String(product.data.category?.id ?? ''), brand_id: String(product.data.brand?.id ?? ''), status: product.data.status === 'published' ? 'published' : 'draft' }); setRows(product.data.variants ?? []) }, [product.data])
  const save = useMutation({ mutationFn: async () => { if (!form.name.trim() || !form.slug.trim() || !form.category_id) throw new Error('Name, slug, and category are required.'); if (!rows?.length) throw new Error('At least one variant is required.'); await sellerRequest('PUT', `/seller/products/${id}`, { ...form, category_id: Number(form.category_id), brand_id: form.brand_id ? Number(form.brand_id) : null, name: form.name.trim(), slug: form.slug.trim().toLowerCase() }); for (const row of rows) { if (!row.id) continue; await sellerRequest('PUT', `/seller/variants/${row.id}`, { sku: row.sku, price_minor: Number(row.price_minor), compare_at_price_minor: row.compare_at_price_minor ? Number(row.compare_at_price_minor) : null, currency: row.currency ?? 'MMK', attributes: row.attributes ?? {}, is_active: row.is_active !== false }); const old = product.data?.variants?.find((item) => item.id === row.id); const delta = Number(row.quantity ?? row.available_quantity) - Number(old?.quantity ?? old?.available_quantity ?? 0); if (delta) await sellerRequest('POST', `/seller/variants/${row.id}/inventory/adjust`, { delta, note: 'Seller product edit' }) } for (const file of files) { const media = new FormData(); media.append('file', file); media.append('alt_text', form.name.trim()); media.append('is_primary', '0'); await sellerRequest('POST', `/seller/products/${id}/images`, media) } }, onSuccess: () => { setSaved(true); client.invalidateQueries({ queryKey: ['seller-products'] }); client.invalidateQueries({ queryKey: ['seller-product', id] }) }, onError: (reason) => { setSaved(false); setError(apiErrorMessage(reason)) } })
  if (product.isLoading || categories.isLoading || brands.isLoading) return <Loading />; if (product.error || !product.data) return <ErrorBox message={apiErrorMessage(product.error ?? new Error('Product not found.'))} />
  const updateRow = (index: number, patch: Partial<NonNullable<Product['variants']>[number]>) => setRows((items) => items?.map((item, itemIndex) => itemIndex === index ? { ...item, ...patch } : item))
  const total = rows?.reduce((sum, row) => sum + Number(row.quantity ?? row.available_quantity ?? 0), 0) ?? 0
  return <><PageTitle title="Edit product" subtitle={`Seller Dashboard / Products / Edit Product · #${product.data.id}`} action={<Link className="button" to="/seller/products"><ArrowLeft size={16} /> Back to products</Link>} /><form className="product-editor edit-product-editor" onSubmit={(event) => { event.preventDefault(); setError(''); save.mutate() }}><div className="product-editor-main"><section className="product-panel"><div className="product-panel-heading"><span className="section-number">01</span><div><h2>Product information</h2><p>Update the details customers see in your storefront.</p></div></div><div className="product-form-grid product-form-grid--two"><label>Product name<input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} /></label><label>URL slug<input value={form.slug} onChange={(e) => setForm({ ...form, slug: e.target.value.toLowerCase().replace(/[^a-z0-9-]+/g, '-') })} /></label><label>Category<select value={form.category_id} onChange={(e) => setForm({ ...form, category_id: e.target.value })}><option value="">Choose a category</option>{(categories.data ?? []).filter((item) => item.is_active).map((item) => <option value={item.id} key={item.id}>{item.name}</option>)}</select></label><label>Brand <span className="label-hint">Optional</span><select value={form.brand_id} onChange={(e) => setForm({ ...form, brand_id: e.target.value })}><option value="">No brand</option>{(brands.data ?? []).map((item) => <option value={item.id} key={item.id}>{item.name}</option>)}</select></label></div><label>Description<textarea rows={6} value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} /></label></section><section className="product-panel"><div className="product-panel-heading"><span className="section-number">02</span><div><h2>Variants, sizes, and colors</h2><p>Each combination keeps its own SKU, price, and inventory.</p></div></div><div className="inventory-overview"><div><span className="inventory-kicker">Total inventory</span><strong>{total} units across {rows?.length ?? 0} variants</strong></div><button type="button" className="button" onClick={() => setRows((items) => [...(items ?? []), { sku: '', price_minor: 0, available_quantity: 0, currency: 'MMK', attributes: { Size: '' }, is_active: true }])}>+ Add variant</button></div>{rows?.map((row, index) => { const option = Object.entries(row.attributes ?? {})[0] ?? ['Size', '']; return <div className="edit-variant-card" key={row.id ?? index}><div className="edit-variant-heading"><strong>Variant {index + 1}</strong><button type="button" className="text-link danger-link" onClick={() => setRows((items) => items?.filter((_, itemIndex) => itemIndex !== index))}>Remove</button></div><div className="product-form-grid product-form-grid--three"><label>Option name<input value={option[0]} onChange={(e) => updateRow(index, { attributes: { [e.target.value]: option[1] } })} placeholder="Size or Color" /></label><label>Option value<input value={option[1]} onChange={(e) => updateRow(index, { attributes: { [option[0]]: e.target.value } })} placeholder="Medium or Blue" /></label><label>SKU<input value={row.sku} onChange={(e) => updateRow(index, { sku: e.target.value })} /></label><label>Price<input type="number" min="0" value={row.price_minor} onChange={(e) => updateRow(index, { price_minor: Number(e.target.value) })} /></label><label>Compare-at price<input type="number" min="0" value={row.compare_at_price_minor ?? ''} onChange={(e) => updateRow(index, { compare_at_price_minor: e.target.value ? Number(e.target.value) : null })} /></label><label>Stock quantity<input type="number" min="0" value={row.quantity ?? row.available_quantity} onChange={(e) => updateRow(index, { quantity: Number(e.target.value) })} /></label></div></div> })}</section><section className="product-panel"><div className="product-panel-heading"><span className="section-number">03</span><div><h2>Image gallery</h2><p>Existing images are preserved. Add JPG, PNG, or WebP files up to 2 MB.</p></div></div><div className="edit-image-grid">{(product.data.images ?? []).map((image) => <div className="edit-image-card" key={image.id}><img src={image.url} alt={image.alt_text ?? form.name} /><span>{image.is_primary ? 'Primary image' : 'Gallery image'}</span></div>)}</div><label className="upload-zone"><input className="visually-hidden" type="file" accept="image/jpeg,image/png,image/webp" multiple onChange={(e) => setFiles(Array.from(e.target.files ?? []).filter((file) => file.size <= 2 * 1024 * 1024))} /><span className="upload-icon"><UploadCloud size={24} /></span><strong>{files.length ? `${files.length} image(s) selected` : 'Add images'}</strong><small>Files over 2 MB are not selected.</small><span className="upload-button">Browse files</span></label></section></div><aside className="product-editor-side"><section className="product-panel publish-panel"><div className="product-panel-heading"><span className="section-number">04</span><div><h2>Publishing</h2><p>Choose storefront visibility.</p></div></div><label>Status<select value={form.status} onChange={(e) => setForm({ ...form, status: e.target.value })}><option value="draft">Draft</option><option value="published">Published</option></select></label></section></aside>{(error || saved) && <div className={error ? 'product-editor-error' : 'edit-success'}>{error || 'Product changes saved successfully.'}</div>}<div className="product-editor-actions"><Link className="button" to="/seller/products">Cancel</Link><button className="button primary" disabled={save.isPending}>{save.isPending ? 'Saving changes…' : 'Save changes'}</button></div></form></>
}
function Inventory() { const { data, isLoading, error } = useQuery({ queryKey: ['seller-inventory'], queryFn: () => sellerRequest<Array<{ product_name: string; sku: string; quantity: number; reserved_quantity: number; available_quantity: number }>>('GET', '/seller/inventory') }); if (isLoading) return <Loading />; return <><PageTitle title="Inventory" subtitle="Stock levels across your own product variants." />{error ? <ErrorBox message={error instanceof Error ? error.message : 'Unable to load inventory'} /> : <div className="card table-card"><table><thead><tr><th>Product</th><th>SKU</th><th>On hand</th><th>Reserved</th><th>Available</th></tr></thead><tbody>{(data ?? []).map((item) => <tr key={item.sku}><td>{item.product_name}</td><td>{item.sku}</td><td>{item.quantity}</td><td>{item.reserved_quantity}</td><td><strong>{item.available_quantity}</strong></td></tr>)}</tbody></table>{!data?.length && <Empty text="No variant inventory to display." />}</div>}</> }
function SellerOrderDetails() {
  const { id } = useParams()
  const query = useQuery({ queryKey: ['seller-order', id], queryFn: () => sellerRequest<SellerOrder>('GET', `/seller/orders/${id}`), enabled: Boolean(id) })
  if (query.isLoading) return <Loading />
  if (query.error || !query.data) return <ErrorBox message={apiErrorMessage(query.error ?? new Error('Unable to load seller order'))} />
  const order = query.data
  return <div className="seller-order-details"><div className="seller-page-actions"><Link className="product-back-link" to="/seller/orders"><ArrowLeft size={16} /> Back to orders</Link></div><section className="card order-detail-summary"><div><span className="kicker">SELLER ORDER</span><h1>{order.order_number}</h1><p className="muted">{order.order?.user?.name ?? 'Customer'}{order.order?.user?.email ? ` · ${order.order.user.email}` : ''}</p></div><div className="order-detail-badges"><span className="pill">{productStatusLabel(order.payment_status ?? 'pending')}</span><span className="pill">{productStatusLabel(order.fulfillment_status)}</span></div></section><section className="card table-card"><table><thead><tr><th>Product</th><th>SKU</th><th>Quantity</th><th>Unit price</th><th>Total</th></tr></thead><tbody>{(order.items ?? []).map((item) => <tr key={item.id}><td>{item.product_name}</td><td>{item.sku}</td><td>{item.quantity}</td><td>{money(item.unit_price_minor, order.currency)}</td><td>{money(item.line_total_minor, order.currency)}</td></tr>)}</tbody></table>{!order.items?.length ? <Empty text="No items were returned for this order." /> : null}</section><section className="card order-detail-meta"><div><small>Seller subtotal</small><strong>{money(order.subtotal_minor, order.currency)}</strong></div><div><small>Commission</small><strong>{money(order.commission_minor, order.currency)}</strong></div><div><small>Net</small><strong>{money(order.net_minor, order.currency)}</strong></div><div><small>Shipment</small><strong>{order.shipments?.[0]?.status ? productStatusLabel(order.shipments[0].status) : 'Not created'}</strong></div></section></div>
}

function Orders() { const { data, isLoading, error } = useQuery({ queryKey: ['seller-orders'], queryFn: () => sellerRequest<SellerOrder[]>('GET', '/seller/orders') }); if (isLoading) return <Loading />; return <><PageTitle title="Orders" subtitle="Fulfill only the seller orders belonging to your store." />{error ? <ErrorBox message={error instanceof Error ? error.message : 'Unable to load orders'} /> : <div className="card table-card"><table><thead><tr><th>Seller order</th><th>Status</th><th>Subtotal</th><th>Commission</th><th>Net</th></tr></thead><tbody>{(data ?? []).map((order) => <tr key={order.id}><td><strong>{order.order_number}</strong></td><td><span className="pill">{order.fulfillment_status}</span></td><td>{money(order.subtotal_minor, order.currency)}</td><td>{money(order.commission_minor, order.currency)}</td><td><strong>{money(order.net_minor, order.currency)}</strong></td></tr>)}</tbody></table>{!data?.length && <Empty text="Seller orders appear here after customer checkout." />}</div>}</> }
function Fulfillment() { const client = useQueryClient(); const { data, isLoading, error } = useQuery({ queryKey: ['seller-fulfillment'], queryFn: () => sellerRequest<Array<SellerOrder & { shipments?: { id: number; status: string; carrier: string | null; tracking_number: string | null }[] }>>('GET', '/seller/orders') }); const shipment = useMutation({ mutationFn: ({ id, carrier, tracking_number }: { id: number; carrier: string; tracking_number: string }) => sellerRequest('POST', `/seller/orders/${id}/shipments`, { carrier, tracking_number }), onSuccess: () => client.invalidateQueries({ queryKey: ['seller-fulfillment'] }) }); const update = useMutation({ mutationFn: ({ id, status }: { id: number; status: string }) => sellerRequest('PATCH', `/seller/shipments/${id}/status`, { status }), onSuccess: () => client.invalidateQueries({ queryKey: ['seller-fulfillment'] }) }); if (isLoading) return <Loading />; if (error) return <ErrorBox message={error instanceof Error ? error.message : 'Unable to load fulfillment'} />; return <><PageTitle title="Fulfillment" subtitle="Create shipments only after payment is verified." />{shipment.error ? <ErrorBox message={apiErrorMessage(shipment.error)} /> : null}<div className="card table-card"><table><thead><tr><th>Seller order</th><th>Payment</th><th>Fulfillment</th><th>Shipment</th><th>Action</th></tr></thead><tbody>{(data ?? []).map((order) => { const current = order.shipments?.[0]; const paid = order.payment_status === 'paid'; return <tr key={order.id}><td><strong>{order.order_number}</strong></td><td><span className="pill">{order.payment_status ?? order.status}</span></td><td><span className="pill">{order.fulfillment_status}</span></td><td>{current ? <><span className="pill">{current.status}</span><small>{current.carrier ?? 'Carrier pending'}{current.tracking_number ? ` · ${current.tracking_number}` : ''}</small></> : 'Not created'}</td><td>{current ? <select value={current.status} onChange={(event) => update.mutate({ id: current.id, status: event.target.value })}><option value="pending">Pending</option><option value="preparing">Preparing</option><option value="shipped">Shipped</option><option value="in_transit">In transit</option><option value="delivered">Delivered</option></select> : <ShipmentForm disabled={shipment.isPending || !paid} onSubmit={(value) => shipment.mutate({ id: order.id, ...value })} />}{!paid && !current ? <small className="muted">Shipment available after verified payment.</small> : null}</td></tr> })}</tbody></table>{!data?.length && <Empty text="No seller orders are ready for fulfillment." />}</div></> }
function LegacyShipmentForm({ disabled, onSubmit }: { disabled: boolean; onSubmit: (value: { carrier: string; tracking_number: string }) => void }) { const [carrier, setCarrier] = useState(''); const [tracking, setTracking] = useState(''); return <form onSubmit={(event) => { event.preventDefault(); onSubmit({ carrier, tracking_number: tracking }) }} style={{ display: 'flex', gap: 6 }}><input aria-label="Carrier" placeholder="Carrier" value={carrier} onChange={(event) => setCarrier(event.target.value)} /><input aria-label="Tracking number" placeholder="Tracking no." value={tracking} onChange={(event) => setTracking(event.target.value)} /><button className="button primary" disabled={disabled}>Create</button></form> }
function ShipmentForm({ disabled, onSubmit }: { disabled: boolean; onSubmit: (value: { carrier: string; tracking_number: string }) => void }) {
  const [method, setMethod] = useState<'self' | 'external'>('external')
  const [carrier, setCarrier] = useState('')
  const [tracking, setTracking] = useState('')
  const selfDelivery = method === 'self'
  return <form onSubmit={(event) => { event.preventDefault(); onSubmit({ carrier: selfDelivery ? 'Kipi Self Delivery' : carrier.trim(), tracking_number: selfDelivery ? '' : tracking.trim() }) }} style={{ display: 'grid', gridTemplateColumns: 'repeat(3, minmax(120px, 1fr))', gap: 6 }}><select aria-label="Delivery method" value={method} onChange={(event) => setMethod(event.target.value as 'self' | 'external')}><option value="external">External courier</option><option value="self">Self delivery</option></select>{selfDelivery ? <input aria-label="Self delivery provider" placeholder="Kipi Self Delivery" value="Kipi Self Delivery" readOnly /> : <input required aria-label="Carrier" placeholder="DHL, FedEx, EMS…" value={carrier} onChange={(event) => setCarrier(event.target.value)} />}{selfDelivery ? <input aria-label="Internal tracking ID" placeholder="Generated by server" value="Generated automatically" readOnly /> : <input required aria-label="Tracking number" placeholder="Real courier tracking number" value={tracking} onChange={(event) => setTracking(event.target.value)} />}<button className="button primary" disabled={false}>Create shipment</button></form>
}
function Earnings() {
  const { data, isLoading, error } = useQuery({ queryKey: ['seller-earnings'], queryFn: () => sellerRequest<SellerEarnings>('GET', '/seller/earnings') })
  if (isLoading) return <Loading />
  if (error || !data) return <ErrorBox message={apiErrorMessage(error ?? new Error('Unable to load earnings.'))} />

  return <>
    <PageTitle title="Earnings" subtitle="Server-derived sales, commission snapshots, refunds, and payout status for your store." />
    <div className="stat-grid earnings-stat-grid">
      <Stat label="Total sales" value={money(data.total_sales_minor, data.currency)} icon={<BarChart3 />} />
      <Stat label="Commission deducted" value={money(data.commission_deducted_minor, data.currency)} icon={<ClipboardList />} />
      <Stat label="Net earnings" value={money(data.net_earnings_minor, data.currency)} icon={<Wallet />} />
      <Stat label="Pending earnings" value={money(data.pending_earnings_minor, data.currency)} icon={<ClipboardList />} />
      <Stat label="Paid earnings" value={money(data.paid_earnings_minor, data.currency)} icon={<Wallet />} />
      <Stat label="Refund adjustments" value={money(data.refund_adjustments_minor, data.currency)} icon={<ArrowLeft />} />
    </div>
    <div className="card table-card earnings-history-card">
      <div className="earnings-section-heading"><div><span className="kicker">IMMUTABLE SNAPSHOTS</span><h2>Commission history</h2><p>Rates and eligible subtotals are read from the server snapshot created after verified payment.</p></div><span className="pill">{data.commission_history.length} records</span></div>
      <table><thead><tr><th>Order</th><th>Brand</th><th>Eligible subtotal</th><th>Rate</th><th>Commission</th><th>Net</th><th>Payment</th><th>Payout</th></tr></thead><tbody>{data.commission_history.map((row) => <tr key={row.id}><td><strong>{row.order_number}</strong><small>Order #{row.order_id}</small></td><td>{row.brand?.name ?? 'No brand recorded'}</td><td>{money(row.eligible_subtotal_minor, row.currency)}</td><td>{(row.percentage_bps / 100).toFixed(row.percentage_bps % 100 ? 2 : 0)}%{row.fixed_minor ? ` + ${money(row.fixed_minor, row.currency)}` : ''}<small>{row.rule_source.replaceAll('_', ' ')}</small></td><td>{money(row.commission_minor, row.currency)}</td><td><strong>{money(row.net_minor, row.currency)}</strong></td><td><span className="pill">{row.payment_status ?? 'Not recorded'}</span></td><td><span className="pill">{row.payout_status ?? 'Not recorded'}</span></td></tr>)}{!data.commission_history.length ? <tr><td colSpan={8}><Empty text="No commission snapshots are available for this seller yet." /></td></tr> : null}</tbody></table>
    </div>
    <div className="card notice"><strong>Financial control</strong><p>Commission is confirmed only after verified payment. Historical rates are not recalculated when Admin settings change. Refund adjustment records are shown when the existing refund workflow has allocated them.</p><p className="muted">{data.payout_processing_configured ? 'Provider payout processing is configured.' : 'Payout provider processing is not configured. Paid earnings will remain zero until an authorized payout workflow records a completed payout.'}</p></div>
  </>
}
function Payouts() { const { data, isLoading } = useQuery({ queryKey: ['seller-payouts'], queryFn: () => sellerRequest<Array<{ id: number; status: string; amount_minor: number; currency: string }>>('GET', '/seller/payouts') }); if (isLoading) return <Loading />; return <><PageTitle title="Payouts" subtitle="Provider-backed payout requests with no locally fabricated success state." /><div className="card table-card"><table><thead><tr><th>ID</th><th>Status</th><th>Amount</th></tr></thead><tbody>{(data ?? []).map((payout) => <tr key={payout.id}><td>#{payout.id}</td><td><span className="pill">{payout.status}</span></td><td>{money(payout.amount_minor, payout.currency)}</td></tr>)}</tbody></table>{!data?.length && <Empty text="No payout requests yet." />}</div></> }
function SettingsPage() { const query = useQuery({ queryKey: ['seller-settings'], queryFn: () => sellerRequest<{ store_policies: Record<string, unknown> | null }>('GET', '/seller/settings') }); const save = useMutation({ mutationFn: (value: { store_policies: Record<string, unknown> }) => sellerRequest('PUT', '/seller/settings', value) }); const { register, handleSubmit } = useForm<{ policyText: string }>({ defaultValues: { policyText: query.data?.store_policies?.summary ? String(query.data.store_policies.summary) : '' } }); return <><PageTitle title="Store settings" subtitle="Manage operational configuration for your seller account." />{query.error ? <ErrorBox message="Unable to load settings" /> : <form className="card form-card" onSubmit={handleSubmit((value) => save.mutate({ store_policies: { summary: value.policyText } }))}><label>Store policy summary<textarea rows={5} placeholder="Returns, support hours, and customer-facing policies" {...register('policyText')} /></label><button className="button primary" disabled={save.isPending}>{save.isPending ? 'Saving…' : 'Save settings'}</button>{save.isSuccess && <span className="success">Settings saved.</span>}</form>}</> }
function PageTitle({ action }: { title: string; subtitle: string; action?: React.ReactNode }) { return action ? <div className="seller-page-actions">{action}</div> : null }
function Stat({ label, value, icon }: { label: string; value: string; icon: React.ReactNode }) { return <div className="stat card"><span className="stat-icon">{icon}</span><div><small>{label}</small><strong>{value}</strong></div></div> }
function Loading() { return <div className="card loading">Loading seller data…</div> }
function ErrorBox({ message }: { message: string }) { return <div className="error block">{message}</div> }
function Empty({ text }: { text: string }) { return <div className="empty">{text}</div> }

export function App() { return <BrowserRouter><Routes><Route path="/seller/login" element={<Login />} /><Route element={<Protected />}><Route element={<Layout />}><Route path="/seller" element={<Overview />} /><Route path="/seller/products" element={<Products />} /><Route path="/seller/products/new" element={<NewProduct />} /><Route path="/seller/products/create" element={<NewProduct />} /><Route path="/seller/products/:id/edit" element={<EditProduct />} /><Route path="/seller/inventory" element={<Inventory />} /><Route path="/seller/orders" element={<Orders />} /><Route path="/seller/orders/:id" element={<SellerOrderDetails />} /><Route path="/seller/fulfillment" element={<FulfillmentPage />} /><Route path="/seller/shipments/:id" element={<ShipmentDetailsPage />} /><Route path="/seller/earnings" element={<Earnings />} /><Route path="/seller/payouts" element={<Payouts />} /><Route path="/seller/settings" element={<SettingsPage />} /></Route></Route><Route path="*" element={<Navigate to="/seller" replace />} /></Routes></BrowserRouter> }
