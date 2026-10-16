import { useEffect, useRef, useState, type ReactNode } from 'react'
import { keepPreviousData, useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { ArrowLeft, ClipboardCheck, Package, SlidersHorizontal } from 'lucide-react'
import { adminApi } from '../services/adminApi'
import { useAdminAuth } from '../store/auth'
import type { InventoryRow, Order, User } from '../types/admin'
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
  const query = useQuery({ queryKey: ['admin-users', search, role, page], queryFn: () => adminApi.users({ q: search, role, page: String(page) }), placeholderData: keepPreviousData })
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
  const query = useQuery({ queryKey: ['admin-inventory', search, lowStock, page], queryFn: () => adminApi.inventory({ q: search, low_stock: String(lowStock), page: String(page) }), placeholderData: keepPreviousData })
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
  const orderDetailRef = useRef<HTMLDivElement>(null)
  const client = useQueryClient()
  const query = useQuery({ queryKey: ['admin-orders', search, status, page], queryFn: () => adminApi.orders({ q: search, fulfillment_status: status, page: String(page), per_page: '10' }), placeholderData: keepPreviousData })
  const mutation = useMutation({ mutationFn: (payload: { id: number; status: string }) => adminApi.updateOrderStatus(payload.id, payload.status), onSuccess: () => { client.invalidateQueries({ queryKey: ['admin-orders'] }); client.invalidateQueries({ queryKey: ['admin-dashboard'] }) } })
  useEffect(() => { if (selectedOrder) orderDetailRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' }) }, [selectedOrder])
  if (query.isLoading) return <LoadingState />
  if (query.isError || !query.data) return <ErrorState />
  return <div className="page-stack"><PageHeader eyebrow="Operations" title="Orders" description="Process fulfillment with controlled status transitions." /><Card><div className="toolbar"><SearchBox value={search} onChange={setSearch} placeholder="Search order number" /><select className="select" value={status} onChange={(event) => { setStatus(event.target.value); setPage(1) }}><option value="">All fulfillment states</option>{['pending', 'confirmed', 'processing', 'shipped', 'delivered', 'cancelled'].map((item) => <option key={item} value={item}>{item}</option>)}</select></div>{query.data.data.length ? <div className="table-wrap"><table><thead><tr><th>Order</th><th>Customer</th><th>Total</th><th>Payment</th><th>Fulfillment</th><th>Update</th></tr></thead><tbody>{query.data.data.map((order) => <tr key={order.id}><td><button className="text-button" onClick={() => setSelectedOrder(order.id)}><strong>{order.order_number}</strong></button><small>{order.placed_at ? new Date(order.placed_at).toLocaleString() : 'Not placed'}</small></td><td>{order.user?.name ?? '—'}</td><td>{order.grand_total_minor.toLocaleString()} {order.currency}</td><td><StatusBadge value={order.payment_status} /></td><td><StatusBadge value={order.fulfillment_status} /></td><td><select className="select compact" value={order.fulfillment_status} onChange={(event) => mutation.mutate({ id: order.id, status: event.target.value })} disabled={order.fulfillment_status === 'delivered' || order.fulfillment_status === 'cancelled'}><option value={order.fulfillment_status}>{order.fulfillment_status}</option>{['confirmed', 'processing', 'shipped', 'delivered', 'cancelled'].filter((item) => item !== order.fulfillment_status).map((item) => <option key={item} value={item}>{item}</option>)}</select></td></tr>)}</tbody></table></div> : <EmptyState title="No orders found" message="Orders will appear here when customers check out." />}<Pagination page={query.data.meta?.current_page ?? 1} pages={query.data.meta?.last_page ?? 1} onChange={setPage} /></Card>{selectedOrder ? <div ref={orderDetailRef} className="order-detail-anchor"><OrderDetails orderId={selectedOrder} onClose={() => setSelectedOrder(null)} /></div> : null}</div>
}

function OrderDetails({ orderId, onClose }: { orderId: number; onClose: () => void }) {
  const client = useQueryClient()
  const query = useQuery({ queryKey: ['admin-order', orderId], queryFn: () => adminApi.order(orderId) })
  const [note, setNote] = useState('')
  const mutation = useMutation({ mutationFn: () => adminApi.addOrderNote(orderId, note), onSuccess: () => { setNote(''); client.invalidateQueries({ queryKey: ['admin-order', orderId] }) } })

  if (query.isLoading) return <Card><LoadingState /></Card>
  if (query.isError || !query.data) return <Card><ErrorState message="Unable to load order details." /></Card>

  const order = query.data
  const primaryShipment = order.shipments?.[0]
  const primaryPayment = order.payments?.[0]
  const trackingNumbers = order.shipments?.map((shipment) => shipment.tracking_number ?? shipment.internal_tracking_id).filter(Boolean) ?? []

  return <Card className="order-detail">
    <div className="detail-heading">
      <div className="order-detail-heading-content">
        <div className="order-header-line"><button className="order-back-button" type="button" onClick={onClose}><ArrowLeft size={15} aria-hidden="true" /><span>Back</span></button><span className="eyebrow">Order details</span><h2>{order.order_number}</h2><StatusBadge value={order.fulfillment_status} /></div>
        <p>{order.user?.name ?? 'Guest'} · {order.user?.email ?? 'No email'}</p>
      </div>
      <div className="order-heading-status"><span>Payment</span><StatusBadge value={order.payment_status} /></div>
    </div>

    <section className="order-detail-section order-meta-section" aria-label="Order, customer, delivery, and payment information">
      <div className="order-meta-block"><h3>Order overview</h3><div className="order-detail-fields"><DetailField label="Order ID" value={order.order_number} /><DetailField label="Order date" value={formatDateTime(order.placed_at)} /><DetailField label="Order status" value={<StatusBadge value={order.fulfillment_status} />} /></div></div>
      <div className="order-meta-block"><h3>Customer information</h3><div className="order-detail-fields"><DetailField label="Customer name" value={order.user?.name ?? 'Guest'} /><DetailField label="Phone" value={order.user?.phone ?? '—'} /><DetailField label="Email" value={order.user?.email ?? '—'} /></div></div>
      <div className="order-meta-block"><h3>Shipping / delivery information</h3><div className="order-detail-fields"><DetailField label="Delivery method" value={order.shipping_method?.name ?? primaryShipment?.delivery_method?.replaceAll('_', ' ') ?? 'Not selected'} /><DetailField label="Delivery status" value={<StatusBadge value={primaryShipment?.status ?? order.fulfillment_status} />} /><DetailField label="Expected delivery" value={formatDate(primaryShipment?.estimated_delivery_at)} /><div className="order-field order-field-wide"><span>Shipping address</span><strong>{formatAddress(order.shipping_address)}</strong></div><div className="order-field order-field-wide"><span>Tracking number</span>{trackingNumbers.length ? <div className="order-tracking-list">{trackingNumbers.map((trackingNumber) => <strong key={trackingNumber}>{trackingNumber}</strong>)}</div> : <strong>Shipment not created</strong>}</div></div></div>
      <div className="order-meta-block"><h3>Payment information</h3><div className="order-detail-fields"><DetailField label="Payment method" value={primaryPayment?.provider?.replaceAll('_', ' ').toUpperCase() ?? '—'} /><DetailField label="Payment status" value={<StatusBadge value={order.payment_status} />} /><DetailField label="Transaction reference" value={getPaymentReference(primaryPayment)} /></div></div>
    </section>

    <section className="order-detail-section order-items-section" aria-labelledby="order-items-heading">
      <div className="section-heading-row"><h3 id="order-items-heading">Order items</h3><span className="muted">{order.items?.length ?? 0} item{order.items?.length === 1 ? '' : 's'}</span></div>
      {order.items?.length ? <div className="table-wrap order-items-table-wrap"><table className="order-items-table"><thead><tr><th>Product</th><th>SKU</th><th>Qty</th><th>Unit price</th><th>Line total</th></tr></thead><tbody>{order.items.map((item, index) => { const lineTotal = item.line_total_minor ?? item.unit_price_minor * item.quantity; return <tr key={item.id ?? `${item.sku}-${index}`}><td><div className="order-product-cell">{item.product_image ? <img src={item.product_image} alt="" /> : <span className="order-item-placeholder"><Package size={18} aria-hidden="true" /></span>}<strong>{item.product_name}</strong></div></td><td>{item.sku || '—'}</td><td>{item.quantity}</td><td>{money(item.unit_price_minor, order.currency)}</td><td><strong>{money(lineTotal, order.currency)}</strong></td></tr> })}</tbody></table></div> : <p className="muted">No order items recorded.</p>}
    </section>

    <section className="order-detail-section" aria-labelledby="order-summary-heading">
      <h3 id="order-summary-heading">Order summary</h3>
      <div className="order-summary-list">
        <SummaryRow label="Subtotal" value={money(order.subtotal_minor, order.currency)} />
        <SummaryRow label="Discount" value={money(order.discount_minor, order.currency)} />
        <SummaryRow label="Shipping fee" value={money(order.shipping_minor, order.currency)} />
        <SummaryRow label="Tax" value={money(order.tax_minor, order.currency)} />
        <SummaryRow label="Grand total" value={money(order.grand_total_minor, order.currency)} emphasized />
      </div>
    </section>

    <section className="order-detail-section order-history-grid" aria-label="Order history and internal notes">
      <div><h3>Status history</h3>{order.status_history?.length ? order.status_history.map((item) => <div className="activity-line" key={item.id}><StatusBadge value={item.to_status} /><span>{item.from_status ?? 'created'} → {item.to_status}<small>{formatDateTime(item.created_at)}{item.note ? ` · ${item.note}` : ''}</small></span></div>) : <p className="muted">No status changes recorded.</p>}</div>
      <div><h3>Internal notes</h3>{order.notes?.length ? order.notes.map((item) => <div className="activity-line" key={item.id}><span>{item.note}<small>{item.user?.name ?? 'Admin'} · {formatDateTime(item.created_at)}</small></span></div>) : <p className="muted">No internal notes.</p>}<form className="inline-form" onSubmit={(event) => { event.preventDefault(); mutation.mutate() }}><input required value={note} onChange={(event) => setNote(event.target.value)} placeholder="Add internal note" /><button className="button primary" disabled={mutation.isPending}>{mutation.isPending ? 'Adding…' : 'Add note'}</button></form></div>
    </section>

    <section className="order-actions-section" aria-labelledby="order-actions-heading"><h3 id="order-actions-heading">Order actions</h3><OrderFinancials order={order} orderId={orderId} /></section>
  </Card>
}

function DetailField({ label, value }: { label: string; value: ReactNode }) {
  return <div className="order-field"><span>{label}</span><strong>{value}</strong></div>
}

function SummaryRow({ label, value, emphasized = false }: { label: string; value: string; emphasized?: boolean }) {
  return <div className={'summary-row' + (emphasized ? ' summary-row-emphasized' : '')}><span>{label}</span><strong>{value}</strong></div>
}

function OrderFinancials({ order, orderId }: { order: Order; orderId: number }) {
  const client = useQueryClient()
  const [deliveryMethod, setDeliveryMethod] = useState<'self_delivery' | 'external_courier'>('external_courier')
  const [carrier, setCarrier] = useState('')
  const [tracking, setTracking] = useState('')
  const [trackingUrl, setTrackingUrl] = useState('')
  const [refundAmount, setRefundAmount] = useState('')
  const collectCod = useMutation({ mutationFn: (paymentId: number) => adminApi.collectCodPayment(paymentId), onSuccess: () => { client.invalidateQueries({ queryKey: ['admin-order', orderId] }); client.invalidateQueries({ queryKey: ['admin-orders'] }); client.invalidateQueries({ queryKey: ['admin-payments'] }) } })
  const verifyManual = useMutation({ mutationFn: (paymentId: number) => adminApi.verifyManualPayment(paymentId), onSuccess: () => { client.invalidateQueries({ queryKey: ['admin-order', orderId] }); client.invalidateQueries({ queryKey: ['admin-orders'] }); client.invalidateQueries({ queryKey: ['admin-payments'] }) } })
  const shipment = useMutation({ mutationFn: () => adminApi.createShipment(orderId, { delivery_method: deliveryMethod, carrier: deliveryMethod === 'self_delivery' ? 'Kipi Self Delivery' : carrier || null, tracking_number: deliveryMethod === 'external_courier' ? tracking || null : null, tracking_url: trackingUrl || null }), onSuccess: () => { setCarrier(''); setTracking(''); setTrackingUrl(''); client.invalidateQueries({ queryKey: ['admin-order', orderId] }) } })
  const shipmentStatus = useMutation({ mutationFn: (payload: { id: number; status: string }) => adminApi.updateShipment(payload.id, { status: payload.status }), onSuccess: () => client.invalidateQueries({ queryKey: ['admin-order', orderId] }) })
  const refund = useMutation({ mutationFn: () => adminApi.createRefund(orderId, { amount_minor: Number(refundAmount), reason: 'Admin refund', idempotency_key: crypto.randomUUID() }), onSuccess: () => { setRefundAmount(''); client.invalidateQueries({ queryKey: ['admin-order', orderId] }) } })
  return <div className="order-financials-grid">
    <div className="order-detail-section"><h4>Payment controls</h4>{order.payments?.length ? order.payments.map((payment) => <div className="activity-line" key={payment.id}><StatusBadge value={payment.status} /><span>{payment.provider.toUpperCase()} · {money(payment.amount_minor, payment.currency)}{payment.provider === 'cod' && payment.status !== 'paid' ? <button className="button secondary compact-action" type="button" onClick={() => collectCod.mutate(payment.id)} disabled={collectCod.isPending}>{collectCod.isPending ? 'Confirming…' : 'Mark Payment as Received'}</button> : null}{['kbzpay', 'wavepay', 'bank_transfer'].includes(payment.provider) && payment.status !== 'paid' ? <button className="button secondary compact-action" type="button" onClick={() => verifyManual.mutate(payment.id)} disabled={verifyManual.isPending}>{verifyManual.isPending ? 'Verifying…' : 'Verify online payment'}</button> : null}<small>{typeof payment.metadata?.sender_phone === 'string' ? `Phone: ${payment.metadata.sender_phone}` : null}{typeof payment.metadata?.transaction_code === 'string' ? ` · Ref: ${payment.metadata.transaction_code}` : null}</small></span></div>) : <p className="muted">No payment records.</p>}{collectCod.isError ? <p className="error-box">COD payment could not be confirmed. Verify the cash was actually received.</p> : null}{verifyManual.isError ? <p className="error-box">Online payment could not be verified. Check the receipt details and your permission.</p> : null}</div>
    <div className="order-detail-section"><h4>Shipments</h4>{order.shipments?.length ? order.shipments.map((item) => <div className="activity-line" key={item.id}><StatusBadge value={item.status} /><span>{item.carrier ?? 'No carrier'} · {item.tracking_number ?? item.internal_tracking_id ?? 'No tracking'}<small><select className="select compact" value={item.status} onChange={(event) => shipmentStatus.mutate({ id: item.id, status: event.target.value })} disabled={shipmentStatus.isPending}><option value={item.status}>{item.status}</option>{shipmentTransitions[item.status]?.map((next) => <option key={next} value={next}>{next}</option>)}</select></small></span></div>) : <p className="muted">No shipments created yet.</p>}<div className="inline-form shipment-create-form"><select value={deliveryMethod} onChange={(event) => setDeliveryMethod(event.target.value as 'self_delivery' | 'external_courier')} aria-label="Delivery method"><option value="external_courier">External courier</option><option value="self_delivery">Self delivery</option></select>{deliveryMethod === 'external_courier' ? <><input value={carrier} onChange={(event) => setCarrier(event.target.value)} placeholder="Carrier name" /><input value={tracking} onChange={(event) => setTracking(event.target.value)} placeholder="Real tracking number" /><input type="url" value={trackingUrl} onChange={(event) => setTrackingUrl(event.target.value)} placeholder="Official tracking URL" /></> : <span className="muted">Server will generate the internal Kipi delivery ID.</span>}<button className="button secondary" type="button" onClick={() => shipment.mutate()} disabled={shipment.isPending || (deliveryMethod === 'external_courier' && !tracking.trim())}>{shipment.isPending ? 'Creating…' : 'Create shipment'}</button></div></div>
    <div className="order-detail-section"><h4>Refunds</h4>{order.refunds?.length ? order.refunds.map((item) => <div className="activity-line" key={item.id}><StatusBadge value={item.status} /><span>{money(item.amount_minor, item.currency)}<small>{item.reason ?? 'No reason provided'}</small></span></div>) : <p className="muted">No refunds recorded.</p>}<div className="inline-form"><input type="number" min="1" value={refundAmount} onChange={(event) => setRefundAmount(event.target.value)} placeholder="Refund amount" aria-label="Refund amount" /><button className="button secondary" type="button" onClick={() => refund.mutate()} disabled={refund.isPending || order.payment_status !== 'paid' || !refundAmount}>{refund.isPending ? 'Processing…' : 'Refund'}</button></div></div>
  </div>
}

function money(value: number | null | undefined, currency: string) {
  return value === null || value === undefined ? '—' : `${value.toLocaleString()} ${currency}`
}

function formatDate(value: string | null | undefined) {
  return value ? new Date(value).toLocaleDateString() : '—'
}

function formatDateTime(value: string | null | undefined) {
  return value ? new Date(value).toLocaleString() : '—'
}

function getPaymentReference(payment: NonNullable<Order['payments']>[number] | undefined) {
  if (!payment) return '—'
  if (payment.provider_payment_id) return payment.provider_payment_id
  return typeof payment.metadata?.transaction_code === 'string' ? payment.metadata.transaction_code : '—'
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
  const query = useQuery({ queryKey: ['admin-audit-logs', search, page], queryFn: () => adminApi.auditLogs({ q: search, page: String(page) }), placeholderData: keepPreviousData })
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
