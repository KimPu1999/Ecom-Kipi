import { Fragment, useEffect, useId, useState, type ReactNode } from 'react'
import { keepPreviousData, useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { ArrowLeft, ChevronDown, ChevronUp, Package, Palette, RotateCcw, SlidersHorizontal, Type } from 'lucide-react'
import { useLocation, useNavigate, useParams } from 'react-router-dom'
import { adminApi } from '../services/adminApi'
import { useAdminAuth } from '../store/auth'
import { DEFAULT_APPEARANCE, FONT_FAMILY_OPTIONS, FONT_SIZE_OPTIONS, useAppearance } from '../store/appearance'
import type { AppearanceColors, AppearanceSettings } from '../store/appearance'
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

type OrderSeller = { id: number; store_name: string }

const sellerColorTones = ['blue', 'teal', 'violet', 'amber', 'rose', 'indigo'] as const

function sellerColorTone(sellerId: number) {
  return sellerColorTones[Math.abs(sellerId) % sellerColorTones.length]
}

function getOrderSellers(order: Order): OrderSeller[] {
  const sellers = new Map<number, OrderSeller>()
  order.items?.forEach((item) => {
    if (item.seller) sellers.set(item.seller.id, item.seller)
  })
  if (!sellers.size) order.seller_orders?.forEach((sellerOrder) => { if (sellerOrder.seller) sellers.set(sellerOrder.seller.id, sellerOrder.seller) })
  return Array.from(sellers.values())
}

function groupOrderItems(order: Order) {
  const groups = new Map<string, { seller: OrderSeller | null; items: NonNullable<Order['items']> }>()
  order.items?.forEach((item) => {
    const key = item.seller ? `seller-${item.seller.id}` : 'seller-unavailable'
    const group = groups.get(key) ?? { seller: item.seller ?? null, items: [] }
    group.items.push(item)
    groups.set(key, group)
  })
  return Array.from(groups.entries()).map(([key, group]) => ({ key, ...group }))
}

function SellerBadge({ seller }: { seller: OrderSeller }) {
  return <span className={`seller-badge seller-badge-${sellerColorTone(seller.id)}`}>{seller.store_name}</span>
}

function SellerBadges({ sellers }: { sellers: OrderSeller[] }) {
  return sellers.length ? <div className="seller-badge-list">{sellers.map((seller) => <SellerBadge key={seller.id} seller={seller} />)}</div> : <span className="muted">Seller unavailable</span>
}

function AccordionSection({ title, summary, defaultOpen = false, className = '', children }: { title: string; summary?: ReactNode; defaultOpen?: boolean; className?: string; children: ReactNode }) {
  const [isOpen, setIsOpen] = useState(defaultOpen)
  const id = useId()
  const headingId = `${id}-heading`
  const contentId = `${id}-content`

  return <section className={`order-accordion ${isOpen ? 'is-open' : ''} ${className}`.trim()}>
    <h3 className="order-accordion-heading" id={headingId}>
      <button className="order-accordion-trigger" type="button" aria-expanded={isOpen} aria-controls={contentId} onClick={() => setIsOpen((open) => !open)}>
        <span className="order-accordion-title">{title}</span>
        {summary ? <span className="order-accordion-summary">{summary}</span> : null}
        {isOpen ? <ChevronUp className="order-accordion-chevron" size={17} aria-hidden="true" /> : <ChevronDown className="order-accordion-chevron" size={17} aria-hidden="true" />}
      </button>
    </h3>
    <div className={`order-accordion-content ${isOpen ? 'is-open' : ''}`} id={contentId} role="region" aria-labelledby={headingId} aria-hidden={!isOpen}>
      <div className="order-accordion-content-inner">{children}</div>
    </div>
  </section>
}

export function OrdersPage() {
  const { search, setSearch, page, setPage } = useListSearch()
  const [status, setStatus] = useState('')
  const navigate = useNavigate()
  const client = useQueryClient()
  const query = useQuery({ queryKey: ['admin-orders', search, status, page], queryFn: () => adminApi.orders({ q: search, fulfillment_status: status, page: String(page), per_page: '10' }), placeholderData: keepPreviousData })
  const mutation = useMutation({ mutationFn: (payload: { id: number; status: string }) => adminApi.updateOrderStatus(payload.id, payload.status), onSuccess: () => { client.invalidateQueries({ queryKey: ['admin-orders'] }); client.invalidateQueries({ queryKey: ['admin-dashboard'] }) } })
  if (query.isLoading) return <LoadingState />
  if (query.isError || !query.data) return <ErrorState />
  return <div className="page-stack"><PageHeader eyebrow="Operations" title="Orders" description="Process fulfillment with controlled status transitions." /><Card><div className="toolbar"><SearchBox value={search} onChange={setSearch} placeholder="Search order number" /><select className="select" value={status} onChange={(event) => { setStatus(event.target.value); setPage(1) }}><option value="">All fulfillment states</option>{['pending', 'confirmed', 'processing', 'shipped', 'delivered', 'cancelled'].map((item) => <option key={item} value={item}>{item}</option>)}</select></div>{query.data.data.length ? <div className="table-wrap"><table><thead><tr><th>Order</th><th>Seller</th><th>Customer</th><th>Total</th><th>Payment</th><th>Fulfillment</th><th>Update</th></tr></thead><tbody>{query.data.data.map((order, index) => { const sellers = getOrderSellers(order); return <tr key={order.id}><td><button className="text-button" onClick={() => navigate(`/admin/orders/${order.id}`, { state: { orderIds: query.data.data.map((item) => item.id), currentIndex: index, listContext: { search, status, page } } })} aria-label={`View details for ${order.order_number}`}><span className="order-id-badge">{order.order_number}</span></button><small>{order.placed_at ? new Date(order.placed_at).toLocaleString() : 'Not placed'}</small></td><td><SellerBadges sellers={sellers} /></td><td><strong className="customer-name">{order.user?.name ?? '—'}</strong></td><td>{order.grand_total_minor.toLocaleString()} {order.currency}</td><td><StatusBadge value={order.payment_status} /></td><td><StatusBadge value={order.fulfillment_status} /></td><td><select className="select compact" value={order.fulfillment_status} onChange={(event) => mutation.mutate({ id: order.id, status: event.target.value })} disabled={order.fulfillment_status === 'delivered' || order.fulfillment_status === 'cancelled'}><option value={order.fulfillment_status}>{order.fulfillment_status}</option>{['confirmed', 'processing', 'shipped', 'delivered', 'cancelled'].filter((item) => item !== order.fulfillment_status).map((item) => <option key={item} value={item}>{item}</option>)}</select></td></tr> })}</tbody></table></div> : <EmptyState title="No orders found" message="Orders will appear here when customers check out." />}<Pagination page={query.data.meta?.current_page ?? 1} pages={query.data.meta?.last_page ?? 1} onChange={setPage} /></Card></div>
}

type OrderNavigationState = {
  orderIds?: number[]
  currentIndex?: number
  listContext?: { search: string; status: string; page: number }
}

export function OrderDetailsPage() {
  const { id } = useParams<{ id: string }>()
  const location = useLocation()
  const navigate = useNavigate()
  const orderId = Number(id)
  const navigationState = (location.state as OrderNavigationState | null) ?? null
  const hasListContext = Array.isArray(navigationState?.orderIds) && navigationState.orderIds.length > 0 && navigationState.currentIndex !== undefined && navigationState.orderIds[navigationState.currentIndex] === orderId
  const fallbackOrders = useQuery({ queryKey: ['admin-order-navigation'], queryFn: () => adminApi.orders({ per_page: '100' }), enabled: !hasListContext })

  if (!id || !Number.isSafeInteger(orderId) || orderId < 1) return <div className="page-stack"><ErrorState message="Order details could not be found." /></div>
  const orderIds = hasListContext ? navigationState.orderIds! : fallbackOrders.data?.data.map((order) => order.id) ?? []
  const currentIndex = hasListContext ? navigationState.currentIndex! : orderIds.indexOf(orderId)
  const previousOrderId = currentIndex > 0 ? orderIds[currentIndex - 1] : null
  const nextOrderId = currentIndex >= 0 && currentIndex < orderIds.length - 1 ? orderIds[currentIndex + 1] : null
  const navigateToOrder = (targetId: number) => {
    const targetIndex = orderIds.indexOf(targetId)
    navigate(`/admin/orders/${targetId}`, { state: { orderIds, currentIndex: targetIndex, listContext: navigationState?.listContext } })
  }
  return <div className="page-stack"><OrderDetails orderId={orderId} previousOrderId={previousOrderId} nextOrderId={nextOrderId} onNavigate={navigateToOrder} /></div>
}

function OrderDetails({ orderId, previousOrderId, nextOrderId, onNavigate }: { orderId: number; previousOrderId: number | null; nextOrderId: number | null; onNavigate: (orderId: number) => void }) {
  const client = useQueryClient()
  const navigate = useNavigate()
  const query = useQuery({ queryKey: ['admin-order', orderId], queryFn: () => adminApi.order(orderId) })
  const [note, setNote] = useState('')
  const mutation = useMutation({ mutationFn: () => adminApi.addOrderNote(orderId, note), onSuccess: () => { setNote(''); client.invalidateQueries({ queryKey: ['admin-order', orderId] }) } })

  if (query.isLoading) return <Card><LoadingState /></Card>
  if (query.isError || !query.data) return <Card><ErrorState message="Unable to load order details." /></Card>

  const order = query.data
  const sellers = getOrderSellers(order)
  const itemGroups = groupOrderItems(order)
  const primaryShipment = order.shipments?.[0]
  const primaryPayment = order.payments?.[0]
  const trackingNumbers = order.shipments?.map((shipment) => shipment.tracking_number ?? shipment.internal_tracking_id).filter(Boolean) ?? []
  const commissionSnapshots = order.seller_orders?.flatMap((sellerOrder) => (sellerOrder.commission_snapshots ?? []).map((snapshot) => ({ ...snapshot, sellerName: sellerOrder.seller?.store_name ?? `Seller #${sellerOrder.seller?.id ?? sellerOrder.id}` }))) ?? []

  return <Card className="order-detail">
    <div className="detail-heading">
      <button className="order-back-button" type="button" onClick={() => navigate('/admin/orders')}><ArrowLeft size={15} aria-hidden="true" /><span>Back</span></button>
      <div className="order-detail-heading-content">
        <div className="order-header-line"><span className="eyebrow">Order details</span><h2>{order.order_number}</h2><StatusBadge value={order.fulfillment_status} /></div>
        <div className="order-customer-meta"><strong>{order.user?.name ?? 'Guest'}</strong><span>{order.user?.email ?? 'No email'}</span></div>
        <div className="order-header-sellers"><span>Seller</span><SellerBadges sellers={sellers} /></div>
        <div className="order-heading-actions"><div className="order-detail-navigation"><button className="order-navigation-button" type="button" onClick={() => previousOrderId && onNavigate(previousOrderId)} disabled={!previousOrderId} aria-label="Previous order">← Previous Order</button><button className="order-navigation-button" type="button" onClick={() => nextOrderId && onNavigate(nextOrderId)} disabled={!nextOrderId} aria-label="Next order">Next Order →</button></div><div className="order-heading-status"><span>Payment</span><StatusBadge value={order.payment_status} /></div></div>
      </div>
    </div>

    <AccordionSection title="Order overview" defaultOpen>
      <div className="order-detail-fields"><DetailField label="Order ID" value={order.order_number} /><DetailField label="Order date" value={formatDateTime(order.placed_at)} /><DetailField label="Order status" value={<StatusBadge value={order.fulfillment_status} />} /><DetailField label="Seller brand" value={<SellerBadges sellers={sellers} />} /></div>
    </AccordionSection>

    <AccordionSection title="Customer information">
      <div className="order-detail-fields"><DetailField label="Customer name" value={order.user?.name ?? 'Guest'} /><DetailField label="Phone" value={order.user?.phone ?? '—'} /><DetailField label="Email" value={order.user?.email ?? '—'} /></div>
    </AccordionSection>

    <AccordionSection title="Shipping / delivery information">
      <div className="order-detail-fields"><DetailField label="Delivery method" value={order.shipping_method?.name ?? primaryShipment?.delivery_method?.replaceAll('_', ' ') ?? 'Not selected'} /><DetailField label="Delivery status" value={<StatusBadge value={primaryShipment?.status ?? order.fulfillment_status} />} /><DetailField label="Expected delivery" value={formatDate(primaryShipment?.estimated_delivery_at)} /><div className="order-field order-field-wide"><span>Shipping address</span><strong>{formatAddress(order.shipping_address)}</strong></div><div className="order-field order-field-wide"><span>Tracking number</span>{trackingNumbers.length ? <div className="order-tracking-list">{trackingNumbers.map((trackingNumber) => <strong key={trackingNumber}>{trackingNumber}</strong>)}</div> : <strong>Shipment not created</strong>}</div></div>
    </AccordionSection>

    <AccordionSection title="Payment information">
      <div className="order-detail-fields"><DetailField label="Payment method" value={primaryPayment?.provider?.replaceAll('_', ' ').toUpperCase() ?? '—'} /><DetailField label="Payment status" value={<StatusBadge value={order.payment_status} />} /><DetailField label="Transaction reference" value={getPaymentReference(primaryPayment)} /></div>
    </AccordionSection>

    <AccordionSection title="Order items" summary={`${order.items?.length ?? 0} item${order.items?.length === 1 ? '' : 's'}`} className="order-items-accordion">
      {order.items?.length ? <div className="table-wrap order-items-table-wrap"><table className="order-items-table"><thead><tr><th>Product</th><th>SKU</th><th>Qty</th><th>Unit price</th><th>Line total</th></tr></thead><tbody>{itemGroups.map((group) => <Fragment key={group.key}><tr className="order-item-seller-row"><td colSpan={5}>{group.seller ? <><span>Seller</span><SellerBadge seller={group.seller} /></> : <><span>Seller</span><span className="muted">Seller unavailable</span></>}</td></tr>{group.items.map((item, index) => { const lineTotal = item.line_total_minor ?? item.unit_price_minor * item.quantity; return <tr key={item.id ?? `${item.sku}-${index}`}><td><div className="order-product-cell">{item.product_image ? <img src={item.product_image} alt="" /> : <span className="order-item-placeholder"><Package size={18} aria-hidden="true" /></span>}<strong>{item.product_name}</strong></div></td><td>{item.sku || '—'}</td><td>{item.quantity}</td><td>{money(item.unit_price_minor, order.currency)}</td><td><strong>{money(lineTotal, order.currency)}</strong></td></tr> })}</Fragment>)}</tbody></table></div> : <p className="muted">No order items recorded.</p>}
    </AccordionSection>

    <AccordionSection title="Order summary">
      <div className="order-summary-list">
        <SummaryRow label="Subtotal" value={money(order.subtotal_minor, order.currency)} />
        <SummaryRow label="Discount" value={money(order.discount_minor, order.currency)} />
        <SummaryRow label="Shipping fee" value={money(order.shipping_minor, order.currency)} />
        <SummaryRow label="Tax" value={money(order.tax_minor, order.currency)} />
        <SummaryRow label="Grand total" value={money(order.grand_total_minor, order.currency)} emphasized />
      </div>
    </AccordionSection>

    <AccordionSection title="Commission snapshots" summary={commissionSnapshots.length ? `${commissionSnapshots.length} confirmed record${commissionSnapshots.length === 1 ? '' : 's'}` : 'Not confirmed'}>
      {commissionSnapshots.length ? <div className="table-wrap"><table><thead><tr><th>Seller</th><th>Rule source</th><th>Rate</th><th>Eligible subtotal</th><th>Commission</th><th>Status</th></tr></thead><tbody>{commissionSnapshots.map((snapshot) => <tr key={snapshot.id}><td>{snapshot.sellerName}</td><td>{snapshot.rule_source.replaceAll('_', ' ')}</td><td>{snapshot.percentage_bps / 100}%</td><td>{money(snapshot.eligible_subtotal_minor, snapshot.currency)}</td><td>{money(snapshot.commission_minor, snapshot.currency)}</td><td><StatusBadge value={snapshot.status} /></td></tr>)}</tbody></table></div> : <p className="muted">Commission is created only after a verified payment. Pending or failed payments have no confirmed commission snapshot.</p>}
    </AccordionSection>

    <AccordionSection title="Activity & internal notes" className="order-history-accordion">
      <div className="order-history-grid"><div><h4>Status history</h4>{order.status_history?.length ? order.status_history.map((item) => <div className="activity-line" key={item.id}><StatusBadge value={item.to_status} /><span>{item.from_status ?? 'created'} → {item.to_status}<small>{formatDateTime(item.created_at)}{item.note ? ` · ${item.note}` : ''}</small></span></div>) : <p className="muted">No status changes recorded.</p>}</div>
        <div><h4>Internal notes</h4>{order.notes?.length ? order.notes.map((item) => <div className="activity-line" key={item.id}><span>{item.note}<small>{item.user?.name ?? 'Admin'} · {formatDateTime(item.created_at)}</small></span></div>) : <p className="muted">No internal notes.</p>}<form className="inline-form" onSubmit={(event) => { event.preventDefault(); mutation.mutate() }}><input required value={note} onChange={(event) => setNote(event.target.value)} placeholder="Add internal note" /><button className="button primary" disabled={mutation.isPending}>{mutation.isPending ? 'Adding…' : 'Add note'}</button></form></div>
      </div>
    </AccordionSection>

    <AccordionSection title="Order actions" className="order-actions-accordion"><OrderFinancials order={order} orderId={orderId} /></AccordionSection>
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
    <div className="order-financial-block"><h4>Payment controls</h4>{order.payments?.length ? order.payments.map((payment) => <div className="activity-line" key={payment.id}><StatusBadge value={payment.status} /><span>{payment.provider.toUpperCase()} · {money(payment.amount_minor, payment.currency)}{payment.provider === 'cod' && payment.status !== 'paid' ? <button className="button secondary compact-action" type="button" onClick={() => collectCod.mutate(payment.id)} disabled={collectCod.isPending}>{collectCod.isPending ? 'Confirming…' : 'Mark Payment as Received'}</button> : null}{['kbzpay', 'wavepay', 'bank_transfer'].includes(payment.provider) && payment.status !== 'paid' ? <button className="button secondary compact-action" type="button" onClick={() => verifyManual.mutate(payment.id)} disabled={verifyManual.isPending}>{verifyManual.isPending ? 'Verifying…' : 'Verify online payment'}</button> : null}<small>{typeof payment.metadata?.sender_phone === 'string' ? `Phone: ${payment.metadata.sender_phone}` : null}{typeof payment.metadata?.transaction_code === 'string' ? ` · Ref: ${payment.metadata.transaction_code}` : null}</small></span></div>) : <p className="muted">No payment records.</p>}{collectCod.isError ? <p className="error-box">COD payment could not be confirmed. Verify the cash was actually received.</p> : null}{verifyManual.isError ? <p className="error-box">Online payment could not be verified. Check the receipt details and your permission.</p> : null}</div>
    <div className="order-financial-block"><h4>Shipments</h4>{order.shipments?.length ? order.shipments.map((item) => <div className="activity-line" key={item.id}><StatusBadge value={item.status} /><span>{item.carrier ?? 'No carrier'} · {item.tracking_number ?? item.internal_tracking_id ?? 'No tracking'}<small><select className="select compact" value={item.status} onChange={(event) => shipmentStatus.mutate({ id: item.id, status: event.target.value })} disabled={shipmentStatus.isPending}><option value={item.status}>{item.status}</option>{shipmentTransitions[item.status]?.map((next) => <option key={next} value={next}>{next}</option>)}</select></small></span></div>) : <p className="muted">No shipments created yet.</p>}<div className="inline-form shipment-create-form"><select value={deliveryMethod} onChange={(event) => setDeliveryMethod(event.target.value as 'self_delivery' | 'external_courier')} aria-label="Delivery method"><option value="external_courier">External courier</option><option value="self_delivery">Self delivery</option></select>{deliveryMethod === 'external_courier' ? <><input value={carrier} onChange={(event) => setCarrier(event.target.value)} placeholder="Carrier name" /><input value={tracking} onChange={(event) => setTracking(event.target.value)} placeholder="Real tracking number" /><input type="url" value={trackingUrl} onChange={(event) => setTrackingUrl(event.target.value)} placeholder="Official tracking URL" /></> : <span className="muted">Server will generate the internal Kipi delivery ID.</span>}<button className="button secondary" type="button" onClick={() => shipment.mutate()} disabled={shipment.isPending || (deliveryMethod === 'external_courier' && !tracking.trim())}>{shipment.isPending ? 'Creating…' : 'Create shipment'}</button></div></div>
    <div className="order-financial-block"><h4>Refunds</h4>{order.refunds?.length ? order.refunds.map((item) => <div className="activity-line" key={item.id}><StatusBadge value={item.status} /><span>{money(item.amount_minor, item.currency)}<small>{item.reason ?? 'No reason provided'}</small></span></div>) : <p className="muted">No refunds recorded.</p>}<div className="inline-form"><input type="number" min="1" value={refundAmount} onChange={(event) => setRefundAmount(event.target.value)} placeholder="Refund amount" aria-label="Refund amount" /><button className="button secondary" type="button" onClick={() => refund.mutate()} disabled={refund.isPending || order.payment_status !== 'paid' || !refundAmount}>{refund.isPending ? 'Processing…' : 'Refund'}</button></div></div>
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
  return <div className="page-stack">
    <PageHeader eyebrow="Workspace" title="General Settings" description="Customize the Admin interface using the settings supported by this application." />
    <AppearanceSettingsPanel />
  </div>
}

export function CommissionSettingsPage() {
  return <div className="page-stack">
    <PageHeader eyebrow="Marketplace finance" title="Commission Settings" description="Manage the global commission policy and seller-specific commission rules." />
    <CommissionSettingsPanel />
  </div>
}

function commissionErrorMessage(error: unknown, fallback: string): string {
  const candidate = error as {
    message?: unknown
    status?: unknown
    errors?: Record<string, unknown>
    response?: { status?: unknown; data?: { message?: unknown; errors?: Record<string, unknown> } }
  }
  const status = typeof candidate.status === 'number'
    ? candidate.status
    : typeof candidate.response?.status === 'number'
      ? candidate.response.status
      : undefined
  if (status === 401) return 'Your admin session has expired. Sign in again to load commission settings.'
  if (status === 403) return 'You are not authorized to manage commission settings.'
  const errors = candidate.errors ?? candidate.response?.data?.errors
  const validationMessage = Object.values(errors ?? {})
    .flatMap((value) => Array.isArray(value) ? value : [value])
    .find((value): value is string => typeof value === 'string')
  if (validationMessage) return validationMessage
  if (typeof candidate.response?.data?.message === 'string') return candidate.response.data.message
  if (typeof candidate.message === 'string') return candidate.message
  return status && status >= 500 ? 'The commission service is temporarily unavailable. Check the Laravel API logs.' : fallback
}

function CommissionSettingsPanel() {
  const isSuperAdmin = useAdminAuth((state) => state.user?.roles?.includes('super_admin') ?? false)
  const client = useQueryClient()
  const settings = useQuery({ queryKey: ['commission-settings'], queryFn: adminApi.commissionSettings, enabled: isSuperAdmin })
  const [search, setSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState('all')
  const rules = useQuery({
    queryKey: ['commission-rules', search, statusFilter],
    queryFn: () => adminApi.commissionRules({ per_page: '100', ...(search ? { q: search } : {}), ...(statusFilter === 'all' ? {} : { is_active: statusFilter === 'active' ? '1' : '0' }) }),
    enabled: isSuperAdmin,
  })
  const sellers = useQuery({ queryKey: ['commission-sellers'], queryFn: () => adminApi.sellers({ per_page: '100' }), enabled: isSuperAdmin })
  const [enabled, setEnabled] = useState(true)
  const [defaultRate, setDefaultRate] = useState('5')
  const [sellerId, setSellerId] = useState('')
  const [brandId, setBrandId] = useState('')
  const [ruleRate, setRuleRate] = useState('5')
  const [fixedMinor, setFixedMinor] = useState('0')
  const [ruleActive, setRuleActive] = useState(true)
  const [editingId, setEditingId] = useState<number | null>(null)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')
  const brands = useQuery({ queryKey: ['commission-seller-brands', sellerId], queryFn: () => adminApi.sellerBrands(Number(sellerId)), enabled: isSuperAdmin && Boolean(sellerId) })

  useEffect(() => {
    if (!settings.data) return
    setEnabled(settings.data.enabled)
    setDefaultRate(String(settings.data.default_percentage_bps / 100))
  }, [settings.data])

  const saveSettings = useMutation({
    mutationFn: () => adminApi.updateCommissionSettings({ commission_enabled: enabled, default_percentage_bps: Math.round(Number(defaultRate) * 100) }),
    onMutate: () => { setError(''); setSuccess('') },
    onSuccess: async () => { await client.invalidateQueries({ queryKey: ['commission-settings'] }); setSuccess('Global commission settings saved.'); },
    onError: (reason) => { setSuccess(''); setError(commissionErrorMessage(reason, 'Commission settings could not be saved.')) },
  })
  const saveRule = useMutation({
    mutationFn: () => {
      const rate = Number(ruleRate)
      if (!sellerId || !Number.isFinite(rate) || rate < 0 || rate > 100) throw new Error('Choose a seller and enter a rate from 0% to 100%.')
      const payload = { seller_id: Number(sellerId), brand_id: brandId ? Number(brandId) : null, category_id: null, percentage_bps: Math.round(rate * 100), fixed_minor: Math.max(0, Number(fixedMinor) || 0), currency: 'MMK', is_active: ruleActive }
      return editingId ? adminApi.updateCommissionRule(editingId, payload) : adminApi.createCommissionRule(payload)
    },
    onMutate: () => { setError(''); setSuccess('') },
    onSuccess: async () => {
      setError('')
      setEditingId(null)
      setSellerId('')
      setBrandId('')
      setRuleRate('5')
      setFixedMinor('0')
      setRuleActive(true)
      await client.invalidateQueries({ queryKey: ['commission-rules'] })
      setSuccess(editingId ? 'Commission rule updated.' : 'Commission rule added.')
    },
    onError: (reason) => { setSuccess(''); setError(commissionErrorMessage(reason, 'Commission rule could not be saved.')) },
  })
  const editRule = (rule: import('../types/admin').CommissionRule) => {
    setEditingId(rule.id)
    setSellerId(String(rule.seller_id ?? ''))
    setBrandId(String(rule.brand_id ?? ''))
    setRuleRate(String(rule.percentage_bps / 100))
    setFixedMinor(String(rule.fixed_minor))
    setRuleActive(rule.is_active)
  }
  const toggleRule = useMutation({
    mutationFn: (rule: import('../types/admin').CommissionRule) => adminApi.updateCommissionRule(rule.id, { seller_id: rule.seller_id, brand_id: rule.brand_id, category_id: rule.category_id, percentage_bps: rule.percentage_bps, fixed_minor: rule.fixed_minor, currency: rule.currency, is_active: !rule.is_active }),
    onMutate: () => { setError(''); setSuccess('') },
    onSuccess: async () => { await client.invalidateQueries({ queryKey: ['commission-rules'] }); setSuccess('Commission rule status updated.') },
    onError: (reason) => { setSuccess(''); setError(commissionErrorMessage(reason, 'Commission rule could not be updated.')) },
  })
  if (!isSuperAdmin) return <Card><div className="settings-row"><div><h2>Authorization</h2><p>Commission controls are restricted to Super Admins. Appearance settings are saved for your current browser.</p></div><StatusBadge value="protected" /></div></Card>
  if (settings.isLoading || sellers.isLoading || rules.isLoading) return <LoadingState />
  if (settings.isError || sellers.isError || rules.isError || !settings.data || !sellers.data || !rules.data) {
    const reason = settings.error ?? sellers.error ?? rules.error
    return <ErrorState message={commissionErrorMessage(reason, 'Commission settings could not be loaded. Check the API connection and try again.')} />
  }
  const requiresMigration = Boolean(settings.data.requires_migration)
  const isUnpersistedDefault = settings.data.persisted === false && !requiresMigration
  const sellerRules = rules.data.data.filter((rule) => rule.seller_id !== null && rule.brand_id === null)
  const brandRules = rules.data.data.filter((rule) => rule.brand_id !== null)
  const previewRate = Number(ruleRate)
  const preview = Number.isFinite(previewRate) ? Math.min(100000, Math.round(100000 * previewRate / 100 + (Number(fixedMinor) || 0))) : 0

  return <Card><div className="card-heading"><div><span className="eyebrow">Marketplace finance</span><h2>Commission control</h2><p className="muted">New commissions use eligible product subtotal only. Shipping is excluded and confirmed snapshots never change when rules change.</p></div><StatusBadge value={enabled ? 'enabled' : 'disabled'} /></div>{requiresMigration ? <div className="marketplace-connection-note" role="status"><div className="connection-dot" /><div><strong>Commission storage is not initialized</strong><p>The API is showing the configured default of {defaultRate}%. Review and run the additive commission migration before saving settings or seller/brand rules.</p></div></div> : isUnpersistedDefault ? <div className="marketplace-connection-note" role="status"><div className="connection-dot" /><div><strong>Using the configured default</strong><p>No saved commission setting exists yet. The API is showing {defaultRate}% until you save the first authoritative setting.</p></div></div> : null}{success ? <p className="success-box" role="status">{success}</p> : null}<div className="commission-settings-grid"><label className="field"><span>Commission switch</span><select className="select" value={enabled ? 'enabled' : 'disabled'} disabled={requiresMigration} onChange={(event) => { const next = event.target.value === 'enabled'; if (!next && !window.confirm('Disable commission for new eligible orders? Existing confirmed history will remain unchanged.')) return; setEnabled(next) }}><option value="enabled">Enabled</option><option value="disabled">Disabled</option></select></label><label className="field"><span>Global default (%)</span><input type="number" min="0" max="100" step="0.01" value={defaultRate} disabled={requiresMigration} onChange={(event) => setDefaultRate(event.target.value)} /></label><button className="button primary commission-save" disabled={saveSettings.isPending || requiresMigration} onClick={() => saveSettings.mutate()}>{saveSettings.isPending ? 'Saving…' : 'Save global settings'}</button></div><div className="commission-rule-editor"><div className="card-heading"><div><h3>{editingId ? 'Edit commission rule' : 'Add commission rule'}</h3><p className="muted">Seller-brand rules take priority over seller rules. A disabled specific rule charges 0% and does not fall back.</p></div><span className="muted">Preview: {preview.toLocaleString()} MMK on 100,000 MMK</span></div><div className="commission-settings-grid"><label className="field"><span>Seller</span><select className="select" value={sellerId} disabled={requiresMigration} onChange={(event) => { setSellerId(event.target.value); setBrandId('') }}><option value="">Choose seller</option>{sellers.data.data.map((seller) => <option value={seller.id} key={seller.id}>{seller.store_name}</option>)}</select></label><label className="field"><span>Brand (optional)</span><select className="select" value={brandId} disabled={requiresMigration || !sellerId || brands.isLoading} onChange={(event) => setBrandId(event.target.value)}><option value="">All seller products</option>{(brands.data ?? []).map((brand) => <option value={brand.id} key={brand.id}>{brand.name}</option>)}</select></label><label className="field"><span>Rate (%)</span><input type="number" min="0" max="100" step="0.01" value={ruleRate} disabled={requiresMigration} onChange={(event) => setRuleRate(event.target.value)} /></label><label className="field"><span>Fixed amount (MMK minor)</span><input type="number" min="0" step="1" value={fixedMinor} disabled={requiresMigration} onChange={(event) => setFixedMinor(event.target.value)} /></label><label className="field checkbox-field"><input type="checkbox" checked={ruleActive} disabled={requiresMigration} onChange={(event) => setRuleActive(event.target.checked)} /><span>Rule active</span></label><div className="button-row"><button className="button primary" disabled={saveRule.isPending || requiresMigration} onClick={() => saveRule.mutate()}>{saveRule.isPending ? 'Saving…' : editingId ? 'Update rule' : 'Add rule'}</button>{editingId ? <button className="button secondary" onClick={() => { setEditingId(null); setSellerId(''); setBrandId(''); setRuleRate('5'); setFixedMinor('0'); setRuleActive(true) }}>Cancel</button> : null}</div></div></div>{error ? <p className="error-box">{error}</p> : null}<div className="commission-rule-toolbar"><SearchBox value={search} onChange={setSearch} placeholder="Search sellers or brands" /><select className="select" value={statusFilter} onChange={(event) => setStatusFilter(event.target.value)}><option value="all">All statuses</option><option value="active">Active</option><option value="inactive">Disabled</option></select></div><div className="table-wrap"><table><thead><tr><th>Seller</th><th>Brand</th><th>Rate</th><th>Source</th><th>Status</th><th>Updated</th><th /></tr></thead><tbody>{[...sellerRules, ...brandRules].map((rule) => <tr key={rule.id}><td>{rule.seller?.store_name ?? 'Seller #'+rule.seller_id}</td><td>{rule.brand?.name ?? 'All seller products'}</td><td>{rule.percentage_bps / 100}%{rule.fixed_minor ? ` + ${rule.fixed_minor} minor` : ''}</td><td>{rule.brand_id !== null ? 'Seller + brand' : 'Seller'}</td><td><StatusBadge value={rule.is_active ? 'active' : 'disabled'} /></td><td>{rule.updated_at ? new Date(rule.updated_at).toLocaleDateString() : '—'}</td><td><div className="button-row"><button className="button small secondary" disabled={requiresMigration} onClick={() => editRule(rule)}>Edit</button><button className="button small ghost" disabled={requiresMigration || toggleRule.isPending} onClick={() => toggleRule.mutate(rule)}>{toggleRule.isPending ? 'Saving…' : rule.is_active ? 'Disable' : 'Enable'}</button></div></td></tr>)}{!sellerRules.length && !brandRules.length ? <tr><td colSpan={7}>No seller or brand overrides. The global default applies.</td></tr> : null}</tbody></table></div></Card>
}

const appearanceColorFields: { key: keyof AppearanceColors; label: string; description: string }[] = [
  { key: 'primary', label: 'Primary / accent', description: 'Buttons, links, active indicators' },
  { key: 'text', label: 'Main text', description: 'Headings and primary values' },
  { key: 'secondaryText', label: 'Secondary text', description: 'Labels, hints, and muted content' },
  { key: 'pageBackground', label: 'Page background', description: 'Main Admin workspace' },
  { key: 'surface', label: 'Card / surface', description: 'Cards, tables, and form panels' },
  { key: 'border', label: 'Border', description: 'Dividers and control borders' },
  { key: 'sidebarBackground', label: 'Sidebar background', description: 'Navigation surface' },
  { key: 'sidebarText', label: 'Sidebar text', description: 'Navigation labels and icons' },
  { key: 'headerBackground', label: 'Header background', description: 'Global header surface' },
  { key: 'headerText', label: 'Header text', description: 'Breadcrumbs and account controls' },
]

const appearanceColorSwatches = ['#315CF5', '#073B9A', '#0EA5E9', '#16A34A', '#FF8A00', '#1E293B', '#64748B', '#F1F5F9', '#FFFFFF']

function hexRgb(value: string) {
  const match = value.match(/^#([0-9a-f]{6})$/i)
  if (!match) return null
  const number = Number.parseInt(match[1], 16)
  return { r: (number >> 16) & 255, g: (number >> 8) & 255, b: number & 255 }
}

function contrastRatio(first: string, second: string) {
  const one = hexRgb(first)
  const two = hexRgb(second)
  if (!one || !two) return 1
  const luminance = (color: typeof one) => {
    const channels = [color.r, color.g, color.b].map((channel) => channel / 255).map((channel) => channel <= 0.03928 ? channel / 12.92 : ((channel + 0.055) / 1.055) ** 2.4)
    return 0.2126 * channels[0] + 0.7152 * channels[1] + 0.0722 * channels[2]
  }
  const lighter = Math.max(luminance(one), luminance(two))
  const darker = Math.min(luminance(one), luminance(two))
  return (lighter + 0.05) / (darker + 0.05)
}

function AppearanceSettingsPanel() {
  const { settings, preview, save, reset } = useAppearance()
  const [draft, setDraft] = useState<AppearanceSettings>(settings)
  const [feedback, setFeedback] = useState('')
  const update = (next: AppearanceSettings) => {
    setDraft(next)
    preview(next)
    setFeedback('')
  }
  const updateColor = (key: keyof AppearanceColors, value: string) => update({ ...draft, colors: { ...draft.colors, [key]: value } })
  const contrastIssues = [
    ['Main text / page background', draft.colors.text, draft.colors.pageBackground],
    ['Main text / surface', draft.colors.text, draft.colors.surface],
    ['Sidebar text / sidebar background', draft.colors.sidebarText, draft.colors.sidebarBackground],
    ['Header text / header background', draft.colors.headerText, draft.colors.headerBackground],
    ['White button text / primary', '#FFFFFF', draft.colors.primary],
  ].filter(([, foreground, background]) => contrastRatio(foreground, background) < 4.5).map(([label]) => label)
  const saveSettings = () => {
    save(draft)
    setFeedback('Appearance settings saved for this browser.')
  }
  const resetSettings = () => {
    const defaults = { ...DEFAULT_APPEARANCE, colors: { ...DEFAULT_APPEARANCE.colors } }
    reset()
    setDraft(defaults)
    setFeedback('Appearance settings reset to defaults.')
  }

  return <Card className="appearance-settings-card">
    <div className="card-heading appearance-card-heading"><div><span className="eyebrow">Admin interface</span><h2>Appearance</h2><p>Preview typography and colors across the Admin panel before saving.</p></div><Palette size={22} className="settings-icon" aria-hidden="true" /></div>
    <div className="appearance-controls">
      <div className="appearance-control-group"><div className="appearance-group-title"><Type size={17} aria-hidden="true" /><div><strong>Typography</strong><span>Use a comfortable size and a Burmese-compatible fallback stack.</span></div></div><div className="appearance-form-grid"><label className="field"><span>Base font size</span><select value={draft.fontSize} onChange={(event) => update({ ...draft, fontSize: event.target.value as AppearanceSettings['fontSize'] })}>{FONT_SIZE_OPTIONS.map((option) => <option value={option.value} key={option.value}>{option.label} ({option.pixels}px)</option>)}</select></label><label className="field"><span>Font family</span><select value={draft.fontFamily} onChange={(event) => update({ ...draft, fontFamily: event.target.value as AppearanceSettings['fontFamily'] })}>{FONT_FAMILY_OPTIONS.map((option) => <option value={option.value} key={option.value}>{option.label}</option>)}</select></label></div></div>
      <div className="appearance-control-group"><div className="appearance-group-title"><Palette size={17} aria-hidden="true" /><div><strong>Color palette</strong><span>Choose a preset swatch or use the color picker for each token.</span></div></div><div className="appearance-color-grid">{appearanceColorFields.map((field) => <ColorSetting key={field.key} field={field} value={draft.colors[field.key]} onChange={(value) => updateColor(field.key, value)} />)}</div></div>
      <div className="appearance-preview" style={{ color: draft.colors.text, backgroundColor: draft.colors.surface, borderColor: draft.colors.border, fontFamily: FONT_FAMILY_OPTIONS.find((option) => option.value === draft.fontFamily)?.stack }}><div><span className="appearance-preview-label">Live preview</span><strong>Kipi Control Center</strong><p>English · မြန်မာစာ ကို မှန်ကန်စွာ ဖော်ပြနိုင်ပါသည်</p></div><button type="button" className="button primary" style={{ backgroundColor: draft.colors.primary }}>Primary action</button></div>
      {contrastIssues.length ? <p className="appearance-warning" role="alert">Improve contrast before saving: {contrastIssues.join(', ')}.</p> : null}
      <div className="appearance-actions"><button type="button" className="button secondary" onClick={resetSettings}><RotateCcw size={15} aria-hidden="true" />Reset to defaults</button><button type="button" className="button primary" onClick={saveSettings} disabled={contrastIssues.length > 0}>Apply and save</button></div>
      {feedback ? <p className="appearance-feedback" role="status">{feedback}</p> : null}
    </div>
  </Card>
}

function ColorSetting({ field, value, onChange }: { field: { key: keyof AppearanceColors; label: string; description: string }; value: string; onChange: (value: string) => void }) {
  return <label className="appearance-color-setting"><span><strong>{field.label}</strong><small>{field.description}</small></span><div className="appearance-color-input"><input type="color" value={value} onChange={(event) => onChange(event.target.value.toUpperCase())} aria-label={field.label} /><code>{value.toUpperCase()}</code><div className="appearance-swatches" aria-label={`${field.label} presets`}>{appearanceColorSwatches.slice(0, 5).map((swatch) => <button type="button" key={swatch} aria-label={`Use ${swatch}`} title={swatch} style={{ backgroundColor: swatch }} onClick={() => onChange(swatch)} />)}</div></div></label>
}
