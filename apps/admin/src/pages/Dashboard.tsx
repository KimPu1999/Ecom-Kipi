import { useState } from 'react'
import { keepPreviousData, useQuery } from '@tanstack/react-query'
import { ArrowUpRight, CircleDollarSign, ShoppingBag, ShoppingCart, Users } from 'lucide-react'
import { Area, AreaChart, Cell, CartesianGrid, Pie, PieChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'
import { Link } from 'react-router-dom'
import { adminApi } from '../services/adminApi'
import { Card, EmptyState, ErrorState, LoadingState, StatusBadge } from '../components/ui'
import type { DashboardData } from '../types/admin'

const colors = ['#2563EB', '#16A34A', '#F59E0B', '#DC2626', '#7C3AED']
const money = (value: number) => new Intl.NumberFormat('en-US', { style: 'currency', currency: 'MMK', maximumFractionDigits: 0 }).format(value)
const axisMoney = (value: number) => `${new Intl.NumberFormat('en-US', { notation: 'compact', maximumFractionDigits: 1 }).format(value)} MMK`

function formatChartDate(value: string | number) {
  const date = new Date(`${String(value)}T00:00:00`)
  return Number.isNaN(date.getTime()) ? String(value) : new Intl.DateTimeFormat('en-US', { month: 'short', day: 'numeric' }).format(date)
}

function SalesTrendCard({ points, isFetching }: { points: DashboardData['sales_trend']; isFetching: boolean }) {
  const interval = points.length > 60 ? 6 : points.length > 14 ? 2 : 0

  return <Card className="chart-card wide sales-trend-card">
    <div className="card-heading"><div><h2>Sales Trend</h2><p>Track sales performance over time.</p></div><span className="chart-legend"><i />Revenue</span>{isFetching ? <span className="chart-updating" role="status">Updating…</span> : null}</div>
    {points.length ? <div className="chart sales-trend-chart" aria-busy={isFetching}><ResponsiveContainer width="100%" height="100%"><AreaChart data={points} margin={{ top: 8, right: 10, left: 4, bottom: 4 }}>
      <defs><linearGradient id="salesTrendFill" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor="#315CF5" stopOpacity={0.22} /><stop offset="100%" stopColor="#315CF5" stopOpacity={0.02} /></linearGradient></defs>
      <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="var(--border)" />
      <XAxis dataKey="date" interval={interval} minTickGap={24} tick={{ fontSize: 11, fill: 'var(--muted)' }} tickFormatter={(value) => formatChartDate(value)} tickLine={false} axisLine={false} angle={points.length > 14 ? -25 : 0} height={points.length > 14 ? 42 : 24} />
      <YAxis width={76} tick={{ fontSize: 11, fill: 'var(--muted)' }} tickFormatter={(value) => axisMoney(Number(value))} tickLine={false} axisLine={false} />
      <Tooltip cursor={{ stroke: '#CBD5E1', strokeDasharray: '3 3' }} contentStyle={{ border: '1px solid var(--border)', borderRadius: 10, background: 'var(--surface)' }} labelFormatter={(value) => formatChartDate(value)} formatter={(value) => [money(Number(value)), 'Revenue']} />
      <Area type="monotone" dataKey="revenue" stroke="#315CF5" strokeWidth={2.5} fill="url(#salesTrendFill)" activeDot={{ r: 4 }} />
    </AreaChart></ResponsiveContainer></div> : <EmptyState title="No sales in this period" message="Verified paid, non-cancelled orders will appear here when recorded." />}
  </Card>
}

export function Dashboard() {
  const [period, setPeriod] = useState('30d')
  const query = useQuery({ queryKey: ['admin-dashboard', period], queryFn: () => adminApi.dashboard(period), placeholderData: keepPreviousData })
  if (query.isPending && !query.data) return <LoadingState />
  if (query.isError && !query.data) return <ErrorState message="The dashboard could not be loaded. Check your administrator access and try again." />
  if (!query.data) return <ErrorState message="The dashboard could not be loaded. Check your administrator access and try again." />
  const data = query.data
  const cards = [
    { label: 'Customers', value: data.metrics.customers.toLocaleString(), icon: Users, color: 'blue', hint: 'Registered accounts', to: '/admin/users' },
    { label: 'Products', value: data.metrics.products.toLocaleString(), icon: ShoppingBag, color: 'purple', hint: 'Catalog records', to: '/admin/products' },
    { label: 'Orders', value: data.metrics.orders.toLocaleString(), icon: ShoppingCart, color: 'amber', hint: `${data.metrics.pending_orders.toLocaleString()} pending`, to: '/admin/orders' },
    { label: 'Paid revenue', value: money(data.metrics.paid_revenue), icon: CircleDollarSign, color: 'green', hint: 'Verified payments', to: '/admin/reports' },
  ]
  return <div className="page-stack">
    <div className="dashboard-toolbar"><select className="select compact" aria-label="Dashboard date range" value={period} onChange={(event) => setPeriod(event.target.value)}><option value="7d">7 Days</option><option value="30d">30 Days</option><option value="90d">90 Days</option></select></div>
    <div className="stat-grid">{cards.map(({ label, value, icon: Icon, color, hint, to }) => <Link key={label} to={to} className="card stat-card stat-card-link"><div className={'stat-icon ' + color}><Icon size={20} /></div><div><span>{label}</span><strong>{value}</strong><small>{hint}</small></div><ArrowUpRight className="stat-arrow" size={17} /></Link>)}</div>
    {query.isError ? <div className="feedback error-box feedback-box"><span>Unable to update this date range. Showing the last successful dashboard data.</span><button className="text-button" type="button" onClick={() => query.refetch()}>Retry</button></div> : null}
    <div className="chart-grid"><SalesTrendCard points={data.sales_trend} isFetching={query.isFetching} /><Card className="chart-card"><div className="card-heading"><div><h2>Order status</h2><p>Current fulfillment mix</p></div></div>{data.status_distribution.length ? <div className="chart donut"><ResponsiveContainer width="100%" height="100%"><PieChart><Pie data={data.status_distribution} dataKey="count" nameKey="status" innerRadius={55} outerRadius={82} paddingAngle={3}>{data.status_distribution.map((entry, index) => <Cell key={entry.status} fill={colors[index % colors.length]} />)}</Pie><Tooltip /></PieChart></ResponsiveContainer></div> : <EmptyState title="No orders yet" message="Order status data will appear here." />}</Card></div>
    <div className="content-grid"><Link to="/admin/orders" className="card dashboard-summary-link"><div className="card-heading"><div><h2>Recent orders</h2><p>Latest customer activity</p></div><span className="inline-link">View all</span></div><div className="compact-list">{data.recent_orders.length ? data.recent_orders.map((order) => <div className="list-row" key={order.id}><div><strong>{order.order_number}</strong><small>{order.user?.name ?? 'Customer'}</small></div><div className="list-meta"><StatusBadge value={order.fulfillment_status} /><strong>{money(order.grand_total_minor)}</strong></div></div>) : <EmptyState title="No recent orders" message="Completed customer orders will appear here." />}</div></Link><Link to="/admin/inventory" className="card dashboard-summary-link"><div className="card-heading"><div><h2>Low stock alerts</h2><p>Variants at or below threshold</p></div><span className="inline-link">Manage</span></div><div className="compact-list">{data.low_stock.length ? data.low_stock.map((item) => <div className="list-row" key={item.variant_id}><div><strong>{item.product ?? 'Unknown product'}</strong><small>{item.sku}</small></div><div className="stock-warning">{item.available_quantity} left</div></div>) : <EmptyState title="Stock looks healthy" message="No low-stock variants found." />}</div></Link></div>
  </div>
}

export function Placeholder() {
  return <EmptyState title="Choose a workspace" message="Use the navigation to manage your store." />
}
