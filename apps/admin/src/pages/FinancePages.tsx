import { useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { CircleDollarSign, FileBarChart, RotateCcw } from 'lucide-react'
import { adminApi } from '../services/adminApi'
import type { Order, PaymentReceiptSubmission } from '../types/admin'
import { Card, EmptyState, ErrorState, LoadingState, PageHeader, StatusBadge } from '../components/ui'

const money = (value: number, currency = 'MMK') => new Intl.NumberFormat('en-US', { style: 'currency', currency, maximumFractionDigits: 0 }).format(value)

export function PaymentsPage() {
  const [status, setStatus] = useState('paid')
  const query = useQuery({ queryKey: ['admin-payments', status], queryFn: () => adminApi.orders({ payment_status: status, per_page: '50' }) })
  if (query.isLoading) return <LoadingState />
  if (query.isError || !query.data) return <ErrorState message="Payments could not be loaded." />
  const orders = query.data.data
  const total = orders.reduce((sum, order) => sum + order.grand_total_minor, 0)
  return <div className="page-stack"><PageHeader eyebrow="Finance" title="Payments" description="Payment state comes from orders updated by verified provider webhooks." action={<select className="select compact" value={status} onChange={(event) => setStatus(event.target.value)}><option value="paid">Paid</option><option value="pending">Pending</option><option value="failed">Failed</option><option value="refunded">Refunded</option></select>} /><div className="stat-grid"><Card className="stat-card"><div className="stat-icon green"><CircleDollarSign size={20} /></div><div><span>{status} orders</span><strong>{orders.length}</strong></div></Card><Card className="stat-card"><div className="stat-icon blue"><CircleDollarSign size={20} /></div><div><span>Order value</span><strong>{money(total, orders[0]?.currency)}</strong></div></Card></div><PaymentReceiptReview /><Card><div className="card-heading"><div><h2>Payment orders</h2><p>Use order details to inspect individual payment attempts.</p></div></div><PaymentTable orders={orders} /></Card></div>
}

function PaymentReceiptReview() {
  const client = useQueryClient()
  const query = useQuery({ queryKey: ['admin-payment-receipts'], queryFn: () => adminApi.paymentReceipts({ status: 'submitted', per_page: '50' }) })
  const [previewUrl, setPreviewUrl] = useState('')
  const [previewId, setPreviewId] = useState<number | null>(null)
  const preview = useMutation({ mutationFn: adminApi.paymentReceiptFile, onSuccess: (blob, paymentId) => { if (previewUrl) URL.revokeObjectURL(previewUrl); setPreviewUrl(URL.createObjectURL(blob)); setPreviewId(paymentId) } })
  const review = useMutation({ mutationFn: ({ receipt, action, reason }: { receipt: PaymentReceiptSubmission; action: 'approve' | 'reject'; reason?: string }) => action === 'approve' ? adminApi.approvePaymentReceipt(receipt.payment_id) : adminApi.rejectPaymentReceipt(receipt.payment_id, reason ?? ''), onSuccess: () => { client.invalidateQueries({ queryKey: ['admin-payment-receipts'] }); client.invalidateQueries({ queryKey: ['admin-payments'] }); client.invalidateQueries({ queryKey: ['admin-orders'] }) } })
  function approve(receipt: PaymentReceiptSubmission) { if (window.confirm('Approve this receipt and verify the payment?')) review.mutate({ receipt, action: 'approve' }) }
  function reject(receipt: PaymentReceiptSubmission) { const reason = window.prompt('Enter a rejection reason:')?.trim(); if (reason) review.mutate({ receipt, action: 'reject', reason }) }
  return <Card><div className="card-heading"><div><h2>Receipt submissions</h2><p>Review private receipt files before confirming manual payments.</p></div><span className="pill">{query.data?.meta?.total ?? 0} pending</span></div>{query.isLoading ? <LoadingState /> : query.isError ? <ErrorState message="Receipt submissions could not be loaded." /> : query.data?.data.length ? <div className="table-wrap"><table><thead><tr><th>Order</th><th>Customer</th><th>Provider</th><th>Sender</th><th>Amount</th><th>Submitted</th><th>Actions</th></tr></thead><tbody>{query.data.data.map((receipt) => <tr key={receipt.payment_id}><td><strong>{receipt.order_number ?? `#${receipt.order_id}`}</strong></td><td>{receipt.customer?.name ?? 'Customer'}<small>{receipt.customer?.email}</small></td><td>{receipt.provider.toUpperCase()}</td><td>{receipt.sender_name ?? '—'}<small>{receipt.transaction_code ?? receipt.sender_phone ?? 'No reference'}</small></td><td>{money(receipt.amount_minor, receipt.currency)}</td><td>{receipt.submitted_at ? new Date(receipt.submitted_at).toLocaleString() : '—'}</td><td><div className="button-row"><button className="button small secondary" type="button" onClick={() => preview.mutate(receipt.payment_id)} disabled={preview.isPending}>{preview.isPending && preview.variables === receipt.payment_id ? 'Opening…' : 'View receipt'}</button><button className="button small primary" type="button" onClick={() => approve(receipt)} disabled={review.isPending}>Approve</button><button className="button small danger" type="button" onClick={() => reject(receipt)} disabled={review.isPending}>Reject</button></div></td></tr>)}</tbody></table></div> : <EmptyState title="No receipts awaiting review" message="Customer submissions will appear here while their payments remain pending." />}{review.isError ? <p className="error-box">The receipt decision could not be saved. The payment remains unchanged.</p> : null}{preview.isError ? <p className="error-box">The private receipt could not be opened.</p> : null}{previewUrl ? <div className="receipt-admin-preview"><div className="card-heading"><strong>Receipt preview{previewId ? ` #${previewId}` : ''}</strong><button className="icon-button" type="button" onClick={() => { URL.revokeObjectURL(previewUrl); setPreviewUrl(''); setPreviewId(null) }} aria-label="Close receipt preview">×</button></div><img src={previewUrl} alt="Payment receipt" /></div> : null}</Card>
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

