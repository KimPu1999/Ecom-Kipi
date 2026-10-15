import { useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { ClipboardCheck, SlidersHorizontal } from 'lucide-react'
import { adminApi } from '../services/adminApi'
import { useAdminAuth } from '../store/auth'
import type { InventoryRow, User } from '../types/admin'
import { Card, EmptyState, ErrorState, LoadingState, PageHeader, Pagination, SearchBox, StatusBadge } from '../components/ui'
import './order-detail.css'

function useListSearch() {
  const [search, setSearch] = useState('')
  const [page, setPage] = useState(1)
  return { search, setSearch: (value: string) => { setSearch(value); setPage(1) }, page, setPage }
}

export function UsersPage() {
  const { search, setSearch, page, setPage } = useListSearch()
  const [role, setRole] = useState('')
  const client = useQueryClient()
  const query = useQuery({ queryKey: ['admin-users', search, role, page], queryFn: () => adminApi.users({ q: search, role, page: String(page) }) })
  const mutation = useMutation({ mutationFn: (payload: { id: number; status: string }) => adminApi.updateUserStatus(payload.id, payload.status), onSuccess: () => client.invalidateQueries({ queryKey: ['admin-users'] }) })
  if (query.isLoading) return <LoadingState />
  if (query.isError || !query.data) return <ErrorState />
  return <div className="page-stack"><PageHeader eyebrow="People" title="Users" description="Search customers and control account access without exposing private data." /><Card><div className="toolbar"><SearchBox value={search} onChange={setSearch} placeholder="Search name or email" /><select className="select" value={role} onChange={(event) => { setRole(event.target.value); setPage(1) }}><option value="">All roles</option><option value="customer">Customer</option><option value="admin">Admin</option><option value="super_admin">Super admin</option></select></div>{query.data.data.length ? <div className="table-wrap"><table><thead><tr><th>User</th><th>Role</th><th>Phone</th><th>Joined</th><th>Status</th><th /></tr></thead><tbody>{query.data.data.map((user) => <tr key={user.id}><td><strong>{user.name}</strong><small>{user.email}</small></td><td><UserRoleEditor user={user} /></td><td>{user.phone ?? '—'}</td><td>{user.created_at ? new Date(user.created_at).toLocaleDateString() : '—'}</td><td><StatusBadge value={user.status} /></td><td><button className="text-button" onClick={() => mutation.mutate({ id: user.id, status: user.status === 'active' ? 'suspended' : 'active' })}>{user.status === 'active' ? 'Suspend' : 'Activate'}</button></td></tr>)}</tbody></table></div> : <EmptyState title="No users found" message="Try another search or role filter." />}<Pagination page={query.data.meta?.current_page ?? 1} pages={query.data.meta?.last_page ?? 1} onChange={setPage} /></Card></div>
}

function UserRoleEditor({ user }: { user: User }) {
  const isSuperAdmin = useAdminAuth((state) => state.user?.roles?.includes('super_admin') ?? false)
  const [value, setValue] = useState(user.roles?.[0] ?? 'customer')
  const mutation = useMutation({ mutationFn: (nextRole: string) => adminApi.updateUserRoles(user.id, [nextRole]) })
  if (!isSuperAdmin) return <div className="role-pills">{user.roles?.map((item) => <span key={item}>{item.replace('_', ' ')}</span>)}</div>
  return <select className="select compact" value={value} onChange={(event) => { const nextRole = event.target.value; setValue(nextRole); mutation.mutate(nextRole) }} disabled={mutation.isPending}><option value="customer">Customer</option><option value="admin">Admin</option><option value="super_admin">Super admin</option></select>
}

export function InventoryPage() {
  const { search, setSearch, page, setPage } = useListSearch()
  const [lowStock, setLowStock] = useState(false)
  const [adjusting, setAdjusting] = useState<InventoryRow | null>(null)
  const client = useQueryClient()
  const query = useQuery({ queryKey: ['admin-inventory', search, lowStock, page], queryFn: () => adminApi.inventory({ q: search, low_stock: String(lowStock), page: String(page) }) })
  const mutation = useMutation({ mutationFn: (payload: { id: number; data: { delta: number; note: string; low_stock_threshold: number } }) => adminApi.adjustInventory(payload.id, payload.data), onSuccess: () => { setAdjusting(null); client.invalidateQueries({ queryKey: ['admin-inventory'] }); client.invalidateQueries({ queryKey: ['admin-dashboard'] }) } })
  if (query.isLoading) return <LoadingState />
  if (query.isError || !query.data) return <ErrorState />
  return <div className="page-stack"><PageHeader eyebrow="Operations" title="Inventory" description="Adjust available stock with an auditable reason and row-level locking." /><Card><div className="toolbar"><SearchBox value={search} onChange={setSearch} placeholder="Search product or SKU" /><label className="checkbox filter-check"><input type="checkbox" checked={lowStock} onChange={(event) => setLowStock(event.target.checked)} /> Low stock only</label></div>{adjusting ? <AdjustForm item={adjusting} onCancel={() => setAdjusting(null)} onSubmit={(data) => mutation.mutate({ id: adjusting.variant_id, data })} /> : null}{query.data.data.length ? <div className="table-wrap"><table><thead><tr><th>Product</th><th>SKU</th><th>On hand</th><th>Reserved</th><th>Available</th><th>Threshold</th><th /></tr></thead><tbody>{query.data.data.map((item) => <tr key={item.id}><td><strong>{item.product ?? '—'}</strong></td><td>{item.sku}</td><td>{item.quantity}</td><td>{item.reserved_quantity}</td><td className={item.is_low_stock ? 'stock-warning' : ''}>{item.available_quantity}</td><td>{item.low_stock_threshold}</td><td><button className="text-button" onClick={() => setAdjusting(item)}><SlidersHorizontal size={15} /> Adjust</button></td></tr>)}</tbody></table></div> : <EmptyState title="No inventory records" message="Create a product variant to initialize stock." />}<Pagination page={query.data.meta?.current_page ?? 1} pages={query.data.meta?.last_page ?? 1} onChange={setPage} /></Card></div>
}

function AdjustForm({ item, onSubmit, onCancel }: { item: InventoryRow; onSubmit: (data: { delta: number; note: string; low_stock_threshold: number }) => void; onCancel: () => void }) {
  const [delta, setDelta] = useState('0')
  const [note, setNote] = useState('')
  const [threshold, setThreshold] = useState(String(item.low_stock_threshold))
  return <form className="inline-form" onSubmit={(event) => { event.preventDefault(); onSubmit({ delta: Number(delta), note, low_stock_threshold: Number(threshold) }) }}><strong>Adjusting {item.sku}</strong><input aria-label="Quantity delta" type="number" value={delta} onChange={(event) => setDelta(event.target.value)} /><input aria-label="Reason" required placeholder="Reason for adjustment" value={note} onChange={(event) => setNote(event.target.value)} /><input aria-label="Low stock threshold" type="number" min="0" value={threshold} onChange={(event) => setThreshold(event.target.value)} /><button className="button primary" type="submit">Save</button><button className="button secondary" type="button" onClick={onCancel}>Cancel</button></form>
}

export function OrdersPage() {
  const { search, setSearch, page, setPage } = useListSearch()
  const [status, setStatus] = useState('')
  const [selectedOrder, setSelectedOrder] = useState<number | null>(null)
  const client = useQueryClient()
  const query = useQuery({ queryKey: ['admin-orders', search, status, page], queryFn: () => adminApi.orders({ q: search, fulfillment_status: status, page: String(page) }) })
  const mutation = useMutation({ mutationFn: (payload: { id: number; status: string }) => adminApi.updateOrderStatus(payload.id, payload.status), onSuccess: () => { client.invalidateQueries({ queryKey: ['admin-orders'] }); client.invalidateQueries({ queryKey: ['admin-dashboard'] }) } })
  if (query.isLoading) return <LoadingState />
  if (query.isError || !query.data) return <ErrorState />
  return <div className="page-stack"><PageHeader eyebrow="Operations" title="Orders" description="Process fulfillment with controlled status transitions." /><Card><div className="toolbar"><SearchBox value={search} onChange={setSearch} placeholder="Search order number" /><select className="select" value={status} onChange={(event) => { setStatus(event.target.value); setPage(1) }}><option value="">All fulfillment states</option>{['pending', 'confirmed', 'processing', 'shipped', 'delivered', 'cancelled'].map((item) => <option key={item} value={item}>{item}</option>)}</select></div>{query.data.data.length ? <div className="table-wrap"><table><thead><tr><th>Order</th><th>Customer</th><th>Total</th><th>Payment</th><th>Fulfillment</th><th>Update</th></tr></thead><tbody>{query.data.data.map((order) => <tr key={order.id}><td><button className="text-button" onClick={() => setSelectedOrder(order.id)}><strong>{order.order_number}</strong></button><small>{order.placed_at ? new Date(order.placed_at).toLocaleString() : 'Not placed'}</small></td><td>{order.user?.name ?? '—'}</td><td>{order.grand_total_minor.toLocaleString()} {order.currency}</td><td><StatusBadge value={order.payment_status} /></td><td><StatusBadge value={order.fulfillment_status} /></td><td><select className="select compact" value={order.fulfillment_status} onChange={(event) => mutation.mutate({ id: order.id, status: event.target.value })} disabled={order.fulfillment_status === 'delivered' || order.fulfillment_status === 'cancelled'}><option value={order.fulfillment_status}>{order.fulfillment_status}</option>{['confirmed', 'processing', 'shipped', 'delivered', 'cancelled'].filter((item) => item !== order.fulfillment_status).map((item) => <option key={item} value={item}>{item}</option>)}</select></td></tr>)}</tbody></table></div> : <EmptyState title="No orders found" message="Orders will appear here when customers check out." />}<Pagination page={query.data.meta?.current_page ?? 1} pages={query.data.meta?.last_page ?? 1} onChange={setPage} /></Card>{selectedOrder ? <OrderDetails orderId={selectedOrder} onClose={() => setSelectedOrder(null)} /> : null}</div>
}

function OrderDetails({ orderId, onClose }: { orderId: number; onClose: () => void }) {
  const client = useQueryClient()
  const query = useQuery({ queryKey: ['admin-order', orderId], queryFn: () => adminApi.order(orderId) })
  const [note, setNote] = useState('')
  const mutation = useMutation({ mutationFn: () => adminApi.addOrderNote(orderId, note), onSuccess: () => { setNote(''); client.invalidateQueries({ queryKey: ['admin-order', orderId] }) } })
  if (query.isLoading) return <Card><LoadingState /></Card>
  if (query.isError || !query.data) return <Card><ErrorState message="Unable to load order details." /></Card>
  const order = query.data
  return <Card className="order-detail"><div className="detail-heading"><div><span className="eyebrow">Order detail</span><h2>{order.order_number}</h2><p>{order.user?.name ?? 'Guest'} · {order.user?.email ?? 'No email'}</p></div><button className="button secondary" onClick={onClose}>Close</button></div><div className="detail-grid"><div><strong>Items</strong>{order.items?.map((item) => <div className="detail-line" key={item.sku}><span>{item.product_name} × {item.quantity}<small>{item.sku}</small></span><span>{item.unit_price_minor.toLocaleString()} {order.currency}</span></div>)}</div><div><strong>Shipping address</strong><p>{formatAddress(order.shipping_address)}</p><strong>Total</strong><p>{order.grand_total_minor.toLocaleString()} {order.currency}</p></div></div><div className="detail-grid"><div><strong>Status history</strong>{order.status_history?.length ? order.status_history.map((item) => <div className="activity-line" key={item.id}><StatusBadge value={item.to_status} /><span>{item.from_status ?? 'created'} → {item.to_status}<small>{new Date(item.created_at).toLocaleString()}</small></span></div>) : <p>No status changes recorded.</p>}</div><div><strong>Internal notes</strong>{order.notes?.map((item) => <div className="activity-line" key={item.id}><span>{item.note}<small>{item.user?.name ?? 'Admin'} · {new Date(item.created_at).toLocaleString()}</small></span></div>)}<form className="inline-form" onSubmit={(event) => { event.preventDefault(); mutation.mutate() }}><input required value={note} onChange={(event) => setNote(event.target.value)} placeholder="Add internal note" /><button className="button primary" disabled={mutation.isPending}>Add note</button></form></div></div><OrderFinancials order={order} orderId={orderId} /></Card>
}

function OrderFinancials({ order, orderId }: { order: import('../types/admin').Order; orderId: number }) {
  const client = useQueryClient()
  const [tracking, setTracking] = useState('')
  const [refundAmount, setRefundAmount] = useState('')
  const shipment = useMutation({ mutationFn: () => adminApi.createShipment(orderId, { carrier: 'Manual', tracking_number: tracking || null }), onSuccess: () => client.invalidateQueries({ queryKey: ['admin-order', orderId] }) })
  const shipmentStatus = useMutation({ mutationFn: (payload: { id: number; status: string }) => adminApi.updateShipment(payload.id, { status: payload.status }), onSuccess: () => client.invalidateQueries({ queryKey: ['admin-order', orderId] }) })
  const refund = useMutation({ mutationFn: () => adminApi.createRefund(orderId, { amount_minor: Number(refundAmount), reason: 'Admin refund', idempotency_key: crypto.randomUUID() }), onSuccess: () => { setRefundAmount(''); client.invalidateQueries({ queryKey: ['admin-order', orderId] }) } })
  return <div className="detail-grid"><div><strong>Payment</strong>{order.payments?.map((payment) => <div className="activity-line" key={payment.id}><StatusBadge value={payment.status} /><span>{payment.amount_minor.toLocaleString()} {payment.currency}</span></div>)}<strong>Shipments</strong>{order.shipments?.map((item) => <div className="activity-line" key={item.id}><StatusBadge value={item.status} /><span>{item.carrier ?? 'Manual'} · {item.tracking_number ?? 'No tracking'}<small><select className="select compact" value={item.status} onChange={(event) => shipmentStatus.mutate({ id: item.id, status: event.target.value })} disabled={shipmentStatus.isPending}><option value={item.status}>{item.status}</option>{shipmentTransitions[item.status]?.map((next) => <option key={next} value={next}>{next}</option>)}</select></small></span></div>)}<div className="inline-form"><input value={tracking} onChange={(event) => setTracking(event.target.value)} placeholder="Tracking number" /><button className="button secondary" onClick={() => shipment.mutate()} disabled={shipment.isPending || order.payment_status !== 'paid'}>Create shipment</button></div></div><div><strong>Refunds</strong>{order.refunds?.map((item) => <div className="activity-line" key={item.id}><StatusBadge value={item.status} /><span>{item.amount_minor.toLocaleString()} {item.currency}</span></div>)}<div className="inline-form"><input type="number" min="1" value={refundAmount} onChange={(event) => setRefundAmount(event.target.value)} placeholder="Refund amount" /><button className="button secondary" onClick={() => refund.mutate()} disabled={refund.isPending || order.payment_status !== 'paid' || !refundAmount}>Refund</button></div></div></div>
}

const shipmentTransitions: Record<string, string[]> = {
  pending: ['preparing', 'failed_delivery'],
  preparing: ['shipped', 'failed_delivery'],
  shipped: ['in_transit', 'delivered', 'failed_delivery'],
  in_transit: ['out_for_delivery', 'delivered', 'failed_delivery'],
  out_for_delivery: ['delivered', 'failed_delivery'],
  failed_delivery: ['preparing', 'returned'],
}

function formatAddress(address: unknown) {
  if (!address || typeof address !== 'object') return 'No shipping address.'
  return Object.values(address as Record<string, unknown>).filter(Boolean).join(', ')
}

export function AuditLogsPage() {
  const { search, setSearch, page, setPage } = useListSearch()
  const query = useQuery({ queryKey: ['admin-audit-logs', search, page], queryFn: () => adminApi.auditLogs({ q: search, page: String(page) }) })
  if (query.isLoading) return <LoadingState />
  if (query.isError || !query.data) return <ErrorState message="Audit logs are restricted to authorized administrators." />
  return <div className="page-stack"><PageHeader eyebrow="Governance" title="Audit logs" description="Append-only administrative activity with sensitive fields excluded." /><Card><div className="toolbar"><SearchBox value={search} onChange={setSearch} placeholder="Search actions or resources" /></div>{query.data.data.length ? <div className="table-wrap"><table><thead><tr><th>Action</th><th>Actor</th><th>Resource</th><th>IP address</th><th>When</th></tr></thead><tbody>{query.data.data.map((log) => <tr key={log.id}><td><strong>{log.action}</strong></td><td>{log.actor?.name ?? 'System'}</td><td>{log.resource_type?.split('\\').pop() ?? '—'} {log.resource_id ?? ''}</td><td>{log.ip_address ?? '—'}</td><td>{new Date(log.created_at).toLocaleString()}</td></tr>)}</tbody></table></div> : <EmptyState title="No activity yet" message="Administrative actions will be recorded here." />}<Pagination page={query.data.meta?.current_page ?? 1} pages={query.data.meta?.last_page ?? 1} onChange={setPage} /></Card></div>
}

export function SettingsPage() {
  const isSuperAdmin = useAdminAuth((state) => state.user?.roles?.includes('super_admin') ?? false)
  const client = useQueryClient()
  const rules = useQuery({ queryKey: ['commission-rules'], queryFn: adminApi.commissionRules, enabled: isSuperAdmin })
  const sellers = useQuery({ queryKey: ['commission-sellers'], queryFn: () => adminApi.sellers({ per_page: '100' }), enabled: isSuperAdmin })
  const [globalRate, setGlobalRate] = useState('')
  const [sellerId, setSellerId] = useState('')
  const [sellerRate, setSellerRate] = useState('')
  const [error, setError] = useState('')
  const save = useMutation({
    mutationFn: async () => {
      const percentage = Number(sellerId ? sellerRate : globalRate)
      if (!Number.isFinite(percentage) || percentage < 0 || percentage > 100) throw new Error('Commission must be between 0% and 100%.')
      const existing = (rules.data?.data ?? []).find((rule) => (sellerId ? rule.seller_id === Number(sellerId) : rule.seller_id === null))
      const payload = { seller_id: sellerId ? Number(sellerId) : null, percentage_bps: Math.round(percentage * 100), fixed_minor: 0, currency: 'MMK', is_active: true }
      return existing ? adminApi.updateCommissionRule(existing.id, payload) : adminApi.createCommissionRule(payload)
    },
    onSuccess: async () => {
      setError('')
      setGlobalRate('')
      setSellerRate('')
      await client.invalidateQueries({ queryKey: ['commission-rules'] })
    },
    onError: (reason) => setError(reason instanceof Error ? reason.message : 'Commission setting could not be saved.'),
  })
  if (!isSuperAdmin) return <div className="page-stack"><PageHeader eyebrow="Workspace" title="Settings" description="Local dashboard preferences and operational notes." /><ErrorState message="Commission controls are restricted to Super Admins." /></div>
  if (rules.isLoading || sellers.isLoading) return <LoadingState />
  if (rules.isError || sellers.isError || !rules.data || !sellers.data) return <ErrorState message="Commission settings could not be loaded." />
  const globalRule = rules.data.data.find((rule) => rule.seller_id === null)
  const overrides = rules.data.data.filter((rule) => rule.seller_id !== null)
  return <div className="page-stack"><PageHeader eyebrow="Workspace" title="Settings" description="Control platform defaults and marketplace commission overrides." /><Card><div className="settings-row"><div><h2>Appearance</h2><p>Use the moon/sun control in the header to change the admin theme.</p></div><ClipboardCheck size={24} className="settings-icon" /></div><div className="settings-row"><div><h2>Authorization</h2><p>Permissions are enforced by Laravel middleware. Commission controls are Super Admin only.</p></div><StatusBadge value="protected" /></div></Card><Card><div className="card-heading"><div><span className="eyebrow">Marketplace finance</span><h2>Commission control</h2><p className="muted">Commission is calculated from eligible product subtotal only. Historical order snapshots are not changed.</p></div><StatusBadge value={String(globalRule?.percentage_bps ? globalRule.percentage_bps / 100 : 5) + '% default'} /></div><form className="toolbar" onSubmit={(event) => { event.preventDefault(); setSellerId(''); save.mutate() }}><label className="field"><span>Global default (%)</span><input type="number" min="0" max="100" step="0.01" value={globalRate} placeholder={String(globalRule?.percentage_bps ? globalRule.percentage_bps / 100 : 5)} onChange={(event) => setGlobalRate(event.target.value)} /></label><button className="button primary" disabled={save.isPending || !globalRate}>Save default</button></form><div className="toolbar"><label className="field"><span>Seller override</span><select className="select" value={sellerId} onChange={(event) => setSellerId(event.target.value)}><option value="">Choose seller</option>{sellers.data.data.map((seller) => <option value={seller.id} key={seller.id}>{seller.store_name}</option>)}</select></label><label className="field"><span>Rate (%)</span><input type="number" min="0" max="100" step="0.01" value={sellerRate} onChange={(event) => setSellerRate(event.target.value)} /></label><button className="button primary" disabled={save.isPending || !sellerId || !sellerRate} onClick={() => save.mutate()}>Save override</button></div>{error ? <p className="error-box">{error}</p> : null}<div className="table-wrap"><table><thead><tr><th>Seller</th><th>Rate</th><th>Currency</th><th>Status</th></tr></thead><tbody>{overrides.map((rule) => <tr key={rule.id}><td>{rule.seller?.store_name ?? 'Seller #' + rule.seller_id}</td><td>{rule.percentage_bps / 100}%</td><td>{rule.currency}</td><td><StatusBadge value={rule.is_active ? 'active' : 'inactive'} /></td></tr>)}{!overrides.length ? <tr><td colSpan={4}>No seller overrides. The global default applies.</td></tr> : null}</tbody></table></div></Card></div>
}
