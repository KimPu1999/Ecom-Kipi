import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { ArrowUpRight, CircleDollarSign, ShoppingBag, ShoppingCart, Users } from 'lucide-react'
import { Cell, CartesianGrid, Line, LineChart, Pie, PieChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'
import { adminApi } from '../services/adminApi'
import { Card, EmptyState, ErrorState, LoadingState, PageHeader, StatusBadge } from '../components/ui'

const colors = ['#2563EB', '#16A34A', '#F59E0B', '#DC2626', '#7C3AED']
const money = (value: number) => new Intl.NumberFormat('en-US', { style: 'currency', currency: 'MMK', maximumFractionDigits: 0 }).format(value)

export function Dashboard() {
  const [period, setPeriod] = useState('30d')
  const query = useQuery({ queryKey: ['admin-dashboard', period], queryFn: () => adminApi.dashboard(period) })
  if (query.isLoading) return <LoadingState />
  if (query.isError || !query.data) return <ErrorState message="The dashboard could not be loaded. Check your administrator access and try again." />
  const data = query.data
  const cards = [
    { label: 'Customers', value: data.metrics.customers.toLocaleString(), icon: Users, color: 'blue', hint: 'Registered accounts' },
    { label: 'Products', value: data.metrics.products.toLocaleString(), icon: ShoppingBag, color: 'purple', hint: 'Catalog records' },
    { label: 'Orders', value: data.metrics.orders.toLocaleString(), icon: ShoppingCart, color: 'amber', hint: `${data.metrics.pending_orders.toLocaleString()} pending` },
    { label: 'Paid revenue', value: money(data.metrics.paid_revenue), icon: CircleDollarSign, color: 'green', hint: 'Verified payments' },
  ]
  return <div className="page-stack">
    <PageHeader eyebrow="Overview" title="Good morning." description={'Live store performance from ' + data.range.from + ' through ' + data.range.to + '.'} action={<select className="select compact" value={period} onChange={(event) => setPeriod(event.target.value)}><option value="today">Today</option><option value="7d">Last 7 days</option><option value="30d">Last 30 days</option><option value="month">This month</option></select>} />
    <div className="stat-grid">{cards.map(({ label, value, icon: Icon, color, hint }) => <Card key={label} className="stat-card"><div className={'stat-icon ' + color}><Icon size={20} /></div><div><span>{label}</span><strong>{value}</strong><small>{hint}</small></div><ArrowUpRight className="stat-arrow" size={17} /></Card>)}</div>
    <div className="chart-grid"><Card className="chart-card wide"><div className="card-heading"><div><h2>Sales trend</h2><p>Paid orders and recognized revenue</p></div><span className="chart-legend"><i />Revenue</span></div><div className="chart"><ResponsiveContainer width="100%" height="100%"><LineChart data={data.sales_trend}><CartesianGrid strokeDasharray="3 3" vertical={false} stroke="var(--border)" /><XAxis dataKey="date" tick={{ fontSize: 11 }} tickFormatter={(value) => value.slice(5)} /><YAxis tick={{ fontSize: 11 }} tickFormatter={(value) => Math.round(value / 1000) + 'k'} /><Tooltip formatter={(value) => money(Number(value))} /><Line type="monotone" dataKey="revenue" stroke="#2563EB" strokeWidth={3} dot={false} /></LineChart></ResponsiveContainer></div></Card><Card className="chart-card"><div className="card-heading"><div><h2>Order status</h2><p>Current fulfillment mix</p></div></div>{data.status_distribution.length ? <div className="chart donut"><ResponsiveContainer width="100%" height="100%"><PieChart><Pie data={data.status_distribution} dataKey="count" nameKey="status" innerRadius={55} outerRadius={82} paddingAngle={3}>{data.status_distribution.map((entry, index) => <Cell key={entry.status} fill={colors[index % colors.length]} />)}</Pie><Tooltip /></PieChart></ResponsiveContainer></div> : <EmptyState title="No orders yet" message="Order status data will appear here." />}</Card></div>
    <div className="content-grid"><Card><div className="card-heading"><div><h2>Recent orders</h2><p>Latest customer activity</p></div><a href="/admin/orders" className="inline-link">View all</a></div><div className="compact-list">{data.recent_orders.length ? data.recent_orders.map((order) => <div className="list-row" key={order.id}><div><strong>{order.order_number}</strong><small>{order.user?.name ?? 'Customer'}</small></div><div className="list-meta"><StatusBadge value={order.fulfillment_status} /><strong>{money(order.grand_total_minor)}</strong></div></div>) : <EmptyState title="No recent orders" message="Completed customer orders will appear here." />}</div></Card><Card><div className="card-heading"><div><h2>Low stock alerts</h2><p>Variants at or below threshold</p></div><a href="/admin/inventory" className="inline-link">Manage</a></div><div className="compact-list">{data.low_stock.length ? data.low_stock.map((item) => <div className="list-row" key={item.variant_id}><div><strong>{item.product ?? 'Unknown product'}</strong><small>{item.sku}</small></div><div className="stock-warning">{item.available_quantity} left</div></div>) : <EmptyState title="Stock looks healthy" message="No low-stock variants found." />}</div></Card></div>
  </div>
}

export function Placeholder() {
  return <EmptyState title="Choose a workspace" message="Use the navigation to manage your store." />
}
