import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { CircleDollarSign, FileBarChart, RotateCcw } from 'lucide-react'
import { adminApi } from '../services/adminApi'
import type { Order } from '../types/admin'
import { Card, EmptyState, ErrorState, LoadingState, PageHeader, StatusBadge } from '../components/ui'

const money = (value: number, currency = 'MMK') => new Intl.NumberFormat('en-US', { style: 'currency', currency, maximumFractionDigits: 0 }).format(value)

export function PaymentsPage() {
  const [status, setStatus] = useState('paid')
  const query = useQuery({ queryKey: ['admin-payments', status], queryFn: () => adminApi.orders({ payment_status: status, per_page: '50' }) })
  if (query.isLoading) return <LoadingState />
  if (query.isError || !query.data) return <ErrorState message="Payments could not be loaded." />
  const orders = query.data.data
  const total = orders.reduce((sum, order) => sum + order.grand_total_minor, 0)
  return <div className="page-stack"><PageHeader eyebrow="Finance" title="Payments" description="Payment state comes from orders updated by verified provider webhooks." action={<select className="select compact" value={status} onChange={(event) => setStatus(event.target.value)}><option value="paid">Paid</option><option value="pending">Pending</option><option value="failed">Failed</option><option value="refunded">Refunded</option></select>} /><div className="stat-grid"><Card className="stat-card"><div className="stat-icon green"><CircleDollarSign size={20} /></div><div><span>{status} orders</span><strong>{orders.length}</strong></div></Card><Card className="stat-card"><div className="stat-icon blue"><CircleDollarSign size={20} /></div><div><span>Order value</span><strong>{money(total, orders[0]?.currency)}</strong></div></Card></div><Card><div className="card-heading"><div><h2>Payment orders</h2><p>Use order details to inspect individual payment attempts.</p></div></div><PaymentTable orders={orders} /></Card></div>
}

export function RefundsPage() {
  const query = useQuery({ queryKey: ['admin-refund-orders'], queryFn: () => adminApi.orders({ per_page: '50' }) })
  if (query.isLoading) return <LoadingState />
  if (query.isError || !query.data) return <ErrorState message="Refundable orders could not be loaded." />
  return <div className="page-stack"><PageHeader eyebrow="Finance" title="Refunds" description="Review refund history and open an order to issue a provider-backed refund." /><Card><div className="card-heading"><div><h2>Orders and refund status</h2><p>Refund creation remains protected by the Laravel refund service.</p></div></div><PaymentTable orders={query.data.data} showRefunds /></Card></div>
}

export function ReportsPage() {
  const [period, setPeriod] = useState('30d')
  const query = useQuery({ queryKey: ['admin-report', period], queryFn: () => adminApi.dashboard(period) })
  if (query.isLoading) return <LoadingState />
  if (query.isError || !query.data) return <ErrorState message="Reports could not be loaded." />
  const data = query.data
  const revenue = data.sales_trend.reduce((sum, point) => sum + point.revenue, 0)
  const units = data.top_products.reduce((sum, product) => sum + product.quantity, 0)
  return <div className="page-stack"><PageHeader eyebrow="Analytics" title="Reports" description={'Operational report for ' + data.range.from + ' through ' + data.range.to + '.'} action={<select className="select compact" value={period} onChange={(event) => setPeriod(event.target.value)}><option value="7d">Last 7 days</option><option value="30d">Last 30 days</option><option value="month">This month</option></select>} /><div className="stat-grid"><Card className="stat-card"><div className="stat-icon blue"><FileBarChart size={20} /></div><div><span>Recognized revenue</span><strong>{money(revenue)}</strong></div></Card><Card className="stat-card"><div className="stat-icon purple"><FileBarChart size={20} /></div><div><span>Top-product units</span><strong>{units}</strong></div></Card><Card className="stat-card"><div className="stat-icon amber"><RotateCcw size={20} /></div><div><span>Orders in period</span><strong>{data.metrics.orders}</strong></div></Card></div><Card><div className="card-heading"><div><h2>Top products</h2><p>Aggregated from paid, non-cancelled order items.</p></div></div>{data.top_products.length ? <div className="compact-list">{data.top_products.map((product) => <div className="list-row" key={product.name}><div><strong>{product.name}</strong><small>{product.quantity} units</small></div><strong>{money(product.revenue)}</strong></div>)}</div> : <EmptyState title="No sales data yet" message="Reports will populate after verified paid orders are recorded." />}</Card></div>
}

function PaymentTable({ orders, showRefunds = false }: { orders: Order[]; showRefunds?: boolean }) {
  return orders.length ? <div className="table-wrap"><table><thead><tr><th>Order</th><th>Customer</th><th>{showRefunds ? 'Refunds' : 'Payment'}</th><th>Total</th><th>Placed</th></tr></thead><tbody>{orders.map((order) => <tr key={order.id}><td><strong>{order.order_number}</strong></td><td>{order.user?.name ?? 'Customer'}</td><td>{showRefunds ? (order.refunds?.length ? order.refunds.map((refund) => <span className="status" key={refund.id}>{refund.status} · {money(refund.amount_minor, refund.currency)}</span>) : 'None recorded') : <StatusBadge value={order.payment_status} />}</td><td>{money(order.grand_total_minor, order.currency)}</td><td>{order.placed_at ? new Date(order.placed_at).toLocaleDateString() : '—'}</td></tr>)}</tbody></table></div> : <EmptyState title="No matching orders" message="There are no orders for this view yet." />
}

