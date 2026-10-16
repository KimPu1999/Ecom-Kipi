import { useState } from 'react'
import { ArrowLeft, Check, ChevronDown, ChevronUp, Clipboard, ExternalLink } from 'lucide-react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { ApiClientError } from '@kipi/api-client'
import { Link, useLocation, useNavigate, useParams } from 'react-router-dom'
import { sellerRequest } from '../lib/api'

type Rider = { id: number; name: string; phone: string | null; seller_id: number | null; status: string }
type TrackingEvent = { id: number; status: string; previous_status?: string | null; message?: string | null; location?: string | null; source?: string | null; occurred_at: string; actor?: { name?: string | null } | null }
type Shipment = {
  id: number
  order_id?: number
  seller_order_id?: number
  delivery_method: 'self_delivery' | 'external_courier' | string | null
  carrier_id?: number | null
  carrier?: string | null
  tracking_number?: string | null
  internal_tracking_id?: string | null
  status: string
  rider_id?: number | null
  estimated_delivery_at?: string | null
  shipped_at?: string | null
  delivered_at?: string | null
  notes?: string | null
  created_at: string
  metadata?: { tracking_url?: string | null } | null
  rider?: Rider | null
  seller_order?: { id: number; order_number: string; seller?: { store_name: string } | null } | null
  order?: { order_number?: string } | null
  items?: { quantity: number; order_item?: { product_name?: string; sku?: string } | null }[]
  tracking?: TrackingEvent[]
}
type SellerOrderItem = {
  id: number
  product_name: string
  sku: string
  quantity: number
  unit_price_minor: number
  line_total_minor: number
  order_item?: {
    attributes?: Record<string, unknown> | null
    variant?: {
      attributes?: Record<string, string> | null
      product?: { images?: { url: string; alt_text?: string | null }[] } | null
    } | null
  } | null
}
type OrderPayment = { provider: string; status: string; provider_payment_id?: string | null; amount_minor?: number | null; currency?: string | null; paid_at?: string | null; created_at?: string | null }
type OrderHistory = { id: number; status_type?: string | null; from_status?: string | null; to_status: string; note?: string | null; created_at?: string | null }
type SellerOrder = {
  id: number
  order_number: string
  status: string
  payment_status?: string
  fulfillment_status: string
  subtotal_minor: number
  shipping_minor?: number
  commission_minor: number
  net_minor: number
  currency: string
  created_at?: string | null
  items?: SellerOrderItem[]
  status_history?: OrderHistory[]
  order?: {
    order_number?: string
    user?: { name?: string | null; email?: string | null; phone?: string | null } | null
    shipping_address?: Record<string, unknown> | null
    placed_at?: string | null
    created_at?: string | null
    subtotal_minor?: number
    discount_minor?: number
    shipping_minor?: number
    tax_minor?: number
    grand_total_minor?: number
    currency?: string
    payment_status?: string
    fulfillment_status?: string
    payments?: OrderPayment[]
    status_history?: OrderHistory[]
    shipping_method?: { name?: string | null; description?: string | null } | null
  }
  shipments?: Shipment[]
}
type ShipmentInput = { delivery_method: 'self_delivery' | 'external_courier'; carrier: string; tracking_number: string; tracking_url: string; rider_id?: number; estimated_delivery_at: string; idempotency_key: string }

const transitions: Record<string, string[]> = {
  pending: ['preparing', 'picked_up', 'failed_delivery'],
  preparing: ['picked_up', 'shipped', 'failed_delivery'],
  picked_up: ['shipped', 'in_transit', 'failed_delivery'],
  shipped: ['in_transit', 'out_for_delivery', 'delivered', 'failed_delivery'],
  in_transit: ['out_for_delivery', 'delivered', 'failed_delivery'],
  out_for_delivery: ['delivered', 'failed_delivery'],
  failed_delivery: ['preparing', 'returned'],
}

function formatDate(value?: string | null) {
  return value ? new Date(value).toLocaleString() : '—'
}

function safeTrackingUrl(value?: string | null) {
  if (!value) return null
  try {
    const url = new URL(value)
    return url.protocol === 'http:' || url.protocol === 'https:' ? url.toString() : null
  } catch {
    return null
  }
}

function money(value?: number | null, currency = 'MMK') {
  if (value === null || value === undefined) return '—'
  return new Intl.NumberFormat('en-US', { style: 'currency', currency, maximumFractionDigits: 0 }).format(value)
}

function humanize(value?: string | null) {
  if (!value) return '—'
  return value.replaceAll('_', ' ').replace(/\b\w/g, (letter) => letter.toUpperCase())
}

function addressText(address?: Record<string, unknown> | null) {
  if (!address) return ''
  return Object.values(address)
    .filter((value): value is string | number => typeof value === 'string' || typeof value === 'number')
    .map(String)
    .filter(Boolean)
    .join(', ')
}

function variantText(item: SellerOrderItem) {
  const attributes = item.order_item?.attributes ?? item.order_item?.variant?.attributes
  if (!attributes) return ''
  return Object.entries(attributes).map(([name, value]) => `${name}: ${String(value)}`).join(' · ')
}

type TimelineItem = { key: string; label: string; timestamp: string; source: string; note?: string | null }

function buildTimeline(order: SellerOrder, shipment: Shipment): TimelineItem[] {
  const timeline: TimelineItem[] = []
  for (const event of order.order?.status_history ?? []) {
    if (event.created_at) timeline.push({ key: `order-${event.id}`, label: humanize(event.to_status), timestamp: event.created_at, source: event.status_type ? `Order · ${humanize(event.status_type)}` : 'Order', note: event.note })
  }
  for (const event of order.status_history ?? []) {
    if (event.created_at) timeline.push({ key: `seller-order-${event.id}`, label: humanize(event.to_status), timestamp: event.created_at, source: 'Seller order', note: event.note })
  }
  for (const payment of order.order?.payments ?? []) {
    const timestamp = payment.paid_at ?? payment.created_at
    if (timestamp) timeline.push({ key: `payment-${payment.provider}-${timestamp}`, label: `Payment ${humanize(payment.status)}`, timestamp, source: humanize(payment.provider) })
  }
  timeline.push({ key: `shipment-created-${shipment.id}`, label: 'Shipment created', timestamp: shipment.created_at, source: 'Fulfillment' })
  for (const event of shipment.tracking ?? []) {
    timeline.push({ key: `shipment-${event.id}`, label: humanize(event.status), timestamp: event.occurred_at, source: event.source ? humanize(event.source) : 'Shipment', note: event.message })
  }
  return timeline.sort((first, second) => new Date(first.timestamp).getTime() - new Date(second.timestamp).getTime())
}

export function FulfillmentPage() {
  const client = useQueryClient()
  const navigate = useNavigate()
  const [error, setError] = useState('')
  const [expandedOrderId, setExpandedOrderId] = useState<number | null>(null)
  const orders = useQuery({ queryKey: ['seller-fulfillment'], queryFn: () => sellerRequest<SellerOrder[]>('GET', '/seller/orders') })
  const riders = useQuery({ queryKey: ['seller-riders'], queryFn: () => sellerRequest<Rider[]>('GET', '/seller/riders') })
  const create = useMutation({
    mutationFn: ({ sellerOrderId, input }: { sellerOrderId: number; input: ShipmentInput }) => sellerRequest<Shipment>('POST', `/seller/orders/${sellerOrderId}/shipments`, {
      delivery_method: input.delivery_method,
      carrier: input.carrier || undefined,
      tracking_number: input.tracking_number || undefined,
      tracking_url: input.tracking_url || undefined,
      rider_id: input.rider_id,
      estimated_delivery_at: input.estimated_delivery_at || undefined,
    }, { headers: { 'Idempotency-Key': input.idempotency_key } }),
    onSuccess: (shipment) => {
      setError('')
      client.invalidateQueries({ queryKey: ['seller-fulfillment'] })
      navigate(`/seller/shipments/${shipment.id}`, { state: { notice: 'Shipment created successfully.' } })
    },
    onError: (reason) => setError(apiErrorMessage(reason)),
    retry: 0,
  })

  if (orders.isLoading || riders.isLoading) return <div className="card loading">Loading fulfillment…</div>
  if (orders.isError || riders.isError) return <ErrorBox message={apiErrorMessage(orders.error ?? riders.error)} />
  const riderOptions = riders.data ?? []
  return <>
    <PageTitle title="Fulfillment" subtitle="Create and manage shipment records for your approved store orders." />
    {error ? <ErrorBox message={error} /> : null}
    <div className="shipment-list">
      {(orders.data ?? []).map((order) => {
        const shipments = order.shipments ?? []
        const cod = order.order?.payments?.some((payment) => payment.provider === 'cod')
        const expanded = expandedOrderId === order.id
        const trackingNumbers = shipments.map((shipment) => shipment.internal_tracking_id ?? shipment.tracking_number).filter(Boolean)
        const deliveryMethods = shipments.map((shipment) => shipment.delivery_method === 'self_delivery' ? 'Self delivery' : shipment.carrier ?? 'External courier').filter(Boolean)
        return <article className={`card shipment-order-card${expanded ? ' is-expanded' : ''}`} key={order.id}>
          <div className="shipment-order-summary">
            <div className="shipment-order-heading"><div><span className="kicker">SELLER ORDER</span><h2>{order.order_number}</h2></div><div className="shipment-order-badges"><span className="pill">Payment: {order.payment_status ?? 'pending'}</span><span className="pill">{order.fulfillment_status}</span></div></div>
            <div className="shipment-order-facts" aria-label={`Order ${order.order_number} summary`}>
              <span><small>Delivery</small><strong>{deliveryMethods.length ? deliveryMethods.join(', ') : 'Not created'}</strong></span>
              <span><small>Tracking</small><strong>{trackingNumbers.length ? trackingNumbers.join(', ') : '—'}</strong></span>
              <span><small>Created</small><strong>{formatDate(order.created_at)}</strong></span>
            </div>
            <button className="shipment-order-toggle" type="button" aria-expanded={expanded} aria-controls={`shipment-details-${order.id}`} onClick={() => { setError(''); setExpandedOrderId((current) => current === order.id ? null : order.id) }}>
              {expanded ? <ChevronUp size={16} aria-hidden="true" /> : <ChevronDown size={16} aria-hidden="true" />}
              <span>{expanded ? 'Hide details' : 'Manage fulfillment'}</span>
            </button>
          </div>
          {expanded ? <div className="shipment-order-details" id={`shipment-details-${order.id}`}>
            <div className="shipment-order-details-heading"><div><strong>Shipment details</strong><small>{shipments.length ? `${shipments.length} shipment${shipments.length === 1 ? '' : 's'} recorded` : 'No shipment has been created yet.'}</small></div><span className="shipment-detail-note">{cod ? 'COD may ship before collection' : 'Payment eligibility is checked by the server'}</span></div>
            {!shipments.length ? <ShipmentCreateForm disabled={create.isPending} riders={riderOptions} allowPendingCod={Boolean(cod)} onSubmit={(input) => create.mutate({ sellerOrderId: order.id, input })} /> : <div className="shipment-order-items">{shipments.map((shipment) => <div className="shipment-list-row" key={shipment.id}><div><strong>{shipment.delivery_method === 'self_delivery' ? 'Self delivery' : shipment.carrier ?? 'External courier'}</strong><small>{shipment.internal_tracking_id ?? shipment.tracking_number ?? `Shipment #${shipment.id}`} · Created {formatDate(shipment.created_at)}</small></div><span className="pill">{shipment.status}</span><Link className="button secondary" to={`/seller/shipments/${shipment.id}`}>View details</Link></div>)}</div>}
          </div> : null}
        </article>
      })}
    </div>
    {!orders.data?.length ? <div className="card empty">No seller orders are available for fulfillment.</div> : null}
  </>
}

function ShipmentCreateForm({ disabled, riders, allowPendingCod, onSubmit }: { disabled: boolean; riders: Rider[]; allowPendingCod: boolean; onSubmit: (input: ShipmentInput) => void }) {
  const [method, setMethod] = useState<ShipmentInput['delivery_method']>('external_courier')
  const [carrier, setCarrier] = useState('')
  const [tracking, setTracking] = useState('')
  const [trackingUrl, setTrackingUrl] = useState('')
  const [riderId, setRiderId] = useState('')
  const [estimated, setEstimated] = useState('')
  const selfDelivery = method === 'self_delivery'
  return <form className="shipment-create-form" onSubmit={(event) => { event.preventDefault(); onSubmit({ delivery_method: method, carrier: selfDelivery ? 'Kipi Self Delivery' : carrier.trim(), tracking_number: selfDelivery ? '' : tracking.trim(), tracking_url: selfDelivery ? '' : trackingUrl.trim(), rider_id: selfDelivery && riderId ? Number(riderId) : undefined, estimated_delivery_at: estimated || '', idempotency_key: crypto.randomUUID() }) }}>
    <div className="shipment-form-heading"><div><strong>Create shipment</strong><small>Shipment starts as Pending. Status is not changed automatically.</small></div>{allowPendingCod ? <span className="status-note">COD may ship before collection</span> : null}</div>
    <div className="shipment-form-grid">
      <label>Delivery method<select value={method} onChange={(event) => setMethod(event.target.value as ShipmentInput['delivery_method'])}><option value="external_courier">External courier</option><option value="self_delivery">Self delivery</option></select></label>
      {selfDelivery ? <label>Assigned rider<select value={riderId} onChange={(event) => setRiderId(event.target.value)}><option value="">No rider assigned</option>{riders.map((rider) => <option value={rider.id} key={rider.id}>{rider.name}{rider.phone ? ` · ${rider.phone}` : ''}</option>)}</select></label> : <label>Carrier name<input required value={carrier} onChange={(event) => setCarrier(event.target.value)} placeholder="DHL, FedEx, EMS…" /></label>}
      {selfDelivery ? <label>Tracking ID<span className="readonly-field">Generated securely by server</span></label> : <label>Real tracking number<input required value={tracking} onChange={(event) => setTracking(event.target.value)} placeholder="Courier-issued tracking number" /></label>}
      {!selfDelivery ? <label>Official tracking URL <span className="label-hint">Optional</span><input type="url" value={trackingUrl} onChange={(event) => setTrackingUrl(event.target.value)} placeholder="https://carrier.example/track/…" /></label> : null}
      <label>Estimated delivery <span className="label-hint">Optional</span><input type="date" min={new Date().toISOString().slice(0, 10)} value={estimated} onChange={(event) => setEstimated(event.target.value)} /></label>
    </div>
    <button className="button primary" disabled={disabled || (!selfDelivery && (!carrier.trim() || !tracking.trim()))}>{disabled ? 'Creating shipment…' : 'Create shipment'}</button>
  </form>
}

export function ShipmentDetailsPage() {
  const { id } = useParams<{ id: string }>()
  const location = useLocation()
  const client = useQueryClient()
  const [copyState, setCopyState] = useState('Copy tracking')
  const [timelineOpen, setTimelineOpen] = useState(false)
  const query = useQuery({ queryKey: ['seller-shipment', id], queryFn: () => sellerRequest<Shipment>('GET', `/seller/shipments/${id}`), enabled: Boolean(id) })
  const sellerOrderId = query.data?.seller_order_id ?? query.data?.seller_order?.id
  const orderQuery = useQuery({ queryKey: ['seller-order-details', sellerOrderId], queryFn: () => sellerRequest<SellerOrder>('GET', `/seller/orders/${sellerOrderId}`), enabled: Boolean(sellerOrderId) })
  const update = useMutation({ mutationFn: (status: string) => sellerRequest<Shipment>('PATCH', `/seller/shipments/${id}/status`, { status }), onSuccess: () => { client.invalidateQueries({ queryKey: ['seller-shipment', id] }); client.invalidateQueries({ queryKey: ['seller-order-details', sellerOrderId] }); client.invalidateQueries({ queryKey: ['seller-fulfillment'] }) }, retry: 0 })
  if (query.isLoading || orderQuery.isLoading) return <div className="card loading">Loading order details…</div>
  if (query.isError || !query.data) return <ErrorBox message={apiErrorMessage(query.error ?? new Error('Shipment not found.'))} />
  if (orderQuery.isError || !orderQuery.data) return <ErrorBox message={apiErrorMessage(orderQuery.error ?? new Error('Order details are unavailable.'))} />

  const shipment = query.data
  const order = orderQuery.data
  const parentOrder = order.order
  const trackingNumber = shipment.internal_tracking_id ?? shipment.tracking_number ?? ''
  const trackingLabel = shipment.delivery_method === 'self_delivery' ? 'Internal tracking ID' : 'Tracking number'
  const trackingUrl = safeTrackingUrl(shipment.metadata?.tracking_url)
  const nextStatuses = transitions[shipment.status] ?? []
  const notice = (location.state as { notice?: string } | null)?.notice
  const orderNumber = order.order_number || parentOrder?.order_number || `Shipment #${shipment.id}`
  const orderCurrency = order.currency || parentOrder?.currency || 'MMK'
  const createdAt = order.created_at ?? parentOrder?.placed_at ?? parentOrder?.created_at ?? shipment.created_at
  const paymentStatus = order.payment_status ?? parentOrder?.payment_status ?? 'pending'
  const fulfillmentStatus = order.fulfillment_status ?? parentOrder?.fulfillment_status ?? shipment.status
  const payment = (parentOrder?.payments ?? []).find((item) => item.status === 'paid') ?? parentOrder?.payments?.[0]
  const address = addressText(parentOrder?.shipping_address)
  const timeline = buildTimeline(order, shipment)
  const deliveryMethod = shipment.delivery_method === 'self_delivery' ? 'Self delivery' : shipment.carrier ?? parentOrder?.shipping_method?.name ?? 'External courier'
  const items = order.items ?? []

  return <div className="shipment-details-page shipment-order-details-page">
    {notice ? <div className="success shipment-notice"><Check size={17} />{notice}</div> : null}
    <header className="card order-details-header">
      <div className="order-details-header-top"><Link className="product-back-link" to="/seller/fulfillment"><ArrowLeft size={16} /> Back to orders</Link><span className="order-details-shipment-id">Shipment #{shipment.id}</span></div>
      <div className="order-details-title-row"><div className="order-details-title-copy"><span className="kicker">ORDER DETAILS</span><h1>{orderNumber}</h1></div><p className="order-details-created">Created {formatDate(createdAt)}</p></div>
    </header>

    <div className="order-details-layout">
      <main className="order-details-main">
        <section className="card order-detail-card">
          <SectionHeading title="Order summary" />
          <div className="order-detail-grid"><DetailField label="Order number" value={orderNumber} /><DetailField label="Created" value={formatDate(createdAt)} /><DetailField label="Delivery method" value={deliveryMethod} /><DetailField label="Seller order status" value={humanize(order.status)} /><DetailField label="Seller subtotal" value={money(order.subtotal_minor, orderCurrency)} /><DetailField label="Seller net" value={money(order.net_minor, orderCurrency)} /></div>
        </section>

        <section className="card order-detail-card">
          <SectionHeading title="Customer information" />
          {parentOrder?.user || address ? <div className="order-detail-grid"><DetailField label="Customer name" value={parentOrder?.user?.name || '—'} /><DetailField label="Email" value={parentOrder?.user?.email || '—'} /><DetailField label="Phone" value={parentOrder?.user?.phone || '—'} />{address ? <div className="order-detail-field order-detail-field--wide"><span>Shipping address</span><strong className="order-address">{address}</strong></div> : null}</div> : <p className="order-empty-note">Customer information is not available for this order.</p>}
        </section>

        <section className="card order-detail-card order-items-card">
          <SectionHeading title="Order items" meta={`${items.length} item${items.length === 1 ? '' : 's'}`} />
          {items.length ? <div className="order-items-table-wrap"><table className="order-items-table"><thead><tr><th>Product</th><th>SKU</th><th>Quantity</th><th>Unit price</th><th>Line total</th></tr></thead><tbody>{items.map((item) => { const image = item.order_item?.variant?.product?.images?.[0]; const variant = variantText(item); return <tr key={item.id}><td data-label="Product"><div className="order-item-product">{image?.url ? <img src={image.url} alt={image.alt_text ?? item.product_name} loading="lazy" /> : <span className="order-item-image-placeholder" aria-hidden="true">—</span>}<span><strong>{item.product_name}</strong>{variant ? <small>{variant}</small> : null}</span></div></td><td data-label="SKU">{item.sku || '—'}</td><td data-label="Quantity">{item.quantity}</td><td data-label="Unit price">{money(item.unit_price_minor, orderCurrency)}</td><td data-label="Line total"><strong>{money(item.line_total_minor, orderCurrency)}</strong></td></tr> })}</tbody></table></div> : <p className="order-empty-note">No order items were returned for this seller order.</p>}
        </section>
      </main>

      <aside className="order-details-sidebar">
        <section className="card order-detail-card payment-summary-card">
          <SectionHeading title="Payment summary" />
          <div className="order-detail-grid order-detail-grid--two"><StatusField label="Payment status" value={humanize(paymentStatus)} /><DetailField label="Payment method" value={payment?.provider ? humanize(payment.provider) : 'Not recorded'} /><DetailField label="Reference ID" value={payment?.provider_payment_id || 'Not recorded'} /><DetailField label="Paid at" value={formatDate(payment?.paid_at)} /></div>
          <div className="order-money-list"><MoneyRow label="Subtotal" value={parentOrder?.subtotal_minor ?? order.subtotal_minor} currency={orderCurrency} />{parentOrder?.discount_minor !== undefined ? <MoneyRow label="Discount" value={parentOrder.discount_minor} currency={orderCurrency} /> : null}{parentOrder?.shipping_minor !== undefined ? <MoneyRow label="Shipping" value={parentOrder.shipping_minor} currency={orderCurrency} /> : null}{parentOrder?.tax_minor !== undefined ? <MoneyRow label="Tax" value={parentOrder.tax_minor} currency={orderCurrency} /> : null}{parentOrder?.grand_total_minor !== undefined ? <MoneyRow label="Grand total" value={parentOrder.grand_total_minor} currency={orderCurrency} emphasis /> : null}</div>
        </section>

        <section className="card order-detail-card fulfillment-summary-card">
          <SectionHeading title="Fulfillment & tracking" />
          <div className="order-detail-grid order-detail-grid--two"><StatusField label="Fulfillment status" value={humanize(fulfillmentStatus)} /><DetailField label="Shipment status" value={humanize(shipment.status)} /><DetailField label="Carrier" value={shipment.carrier || (shipment.delivery_method === 'self_delivery' ? 'Kipi Self Delivery' : '—')} /><DetailField label={trackingLabel} value={trackingNumber || 'Not provided'} /><DetailField label="Estimated delivery" value={formatDate(shipment.estimated_delivery_at)} /><DetailField label="Shipped" value={formatDate(shipment.shipped_at)} /><DetailField label="Delivered" value={formatDate(shipment.delivered_at)} /><DetailField label="Assigned rider" value={shipment.rider?.name || 'Not assigned'} /></div>
          {trackingNumber || trackingUrl ? <div className="order-details-actions">{trackingNumber ? <button className="button secondary" type="button" onClick={async () => { try { await navigator.clipboard.writeText(trackingNumber); setCopyState('Copied') } catch { setCopyState('Copy unavailable') } }}><Clipboard size={16} />{copyState}</button> : null}{trackingUrl ? <a className="button" href={trackingUrl} target="_blank" rel="noreferrer"><ExternalLink size={16} />Open tracking link</a> : null}</div> : <p className="order-empty-note">No tracking information is available for this shipment.</p>}
          <div className="order-status-control"><label htmlFor="shipment-status">Update shipment status</label><select id="shipment-status" className="select" value="" onChange={(event) => { if (event.target.value) update.mutate(event.target.value) }} disabled={update.isPending || !nextStatuses.length}><option value="">{nextStatuses.length ? 'Choose next status' : 'No further status available'}</option>{nextStatuses.map((status) => <option key={status} value={status}>{humanize(status)}</option>)}</select>{update.isPending ? <p className="muted">Saving status…</p> : null}{update.isError ? <ErrorBox message={apiErrorMessage(update.error)} /> : null}</div>
        </section>
      </aside>
    </div>

    <section className="card order-detail-card order-timeline-card">
      <button className="order-timeline-toggle" id={`order-timeline-heading-${shipment.id}`} type="button" aria-expanded={timelineOpen} aria-controls={`order-timeline-${shipment.id}`} onClick={() => setTimelineOpen((open) => !open)}>
        <span>Order timeline</span>
        {timelineOpen ? <ChevronUp size={17} aria-hidden="true" /> : <ChevronDown size={17} aria-hidden="true" />}
      </button>
      <div className={`order-timeline-panel${timelineOpen ? ' is-open' : ''}`} id={`order-timeline-${shipment.id}`} role="region" aria-labelledby={`order-timeline-heading-${shipment.id}`} aria-hidden={!timelineOpen}>
        <div className="order-timeline-panel-inner">{timeline.length ? <div className="order-timeline">{timeline.map((event) => <div className="order-timeline-event" key={event.key}><span className="order-timeline-dot" /><div><strong>{event.label}</strong><small>{formatDate(event.timestamp)} · {event.source}</small>{event.note ? <p>{event.note}</p> : null}</div></div>)}</div> : <p className="order-empty-note">Timeline events are not available for this order.</p>}</div>
      </div>
    </section>
  </div>
}

function SectionHeading({ title, meta }: { title: string; meta?: string }) {
  return <div className="order-detail-heading"><h2>{title}</h2>{meta ? <span>{meta}</span> : null}</div>
}

function DetailField({ label, value }: { label: string; value: string }) {
  return <div className="order-detail-field"><span>{label}</span><strong>{value}</strong></div>
}

function StatusField({ label, value }: { label: string; value: string }) {
  return <div className="order-detail-field"><span>{label}</span><strong><span className="pill order-status-badge">{value}</span></strong></div>
}

function MoneyRow({ label, value, currency, emphasis = false }: { label: string; value: number; currency: string; emphasis?: boolean }) {
  return <div className={`order-money-row${emphasis ? ' is-total' : ''}`}><span>{label}</span><strong>{money(value, currency)}</strong></div>
}

function apiErrorMessage(error: unknown) {
  if (error instanceof ApiClientError) {
    const details = Object.entries(error.errors ?? {}).map(([field, messages]) => `${field}: ${messages.join(' ')}`).join(' ')
    return details ? `${error.message}: ${details}` : error.message
  }
  return error instanceof Error ? error.message : 'Something went wrong. Please try again.'
}

function PageTitle({ title, subtitle }: { title: string; subtitle: string }) {
  void title
  void subtitle
  return null
}

function ErrorBox({ message }: { message: string }) {
  return <div className="error block">{message}</div>
}
