import { useState } from 'react'
import { ArrowLeft, Check, Clipboard, ExternalLink, Truck } from 'lucide-react'
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
type SellerOrder = { id: number; order_number: string; status: string; payment_status?: string; fulfillment_status: string; subtotal_minor: number; commission_minor: number; net_minor: number; currency: string; order?: { payments?: { provider: string; status: string }[] }; shipments?: Shipment[] }
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

export function FulfillmentPage() {
  const client = useQueryClient()
  const navigate = useNavigate()
  const [error, setError] = useState('')
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
        return <div className="card shipment-order-card" key={order.id}>
          <div className="shipment-order-heading"><div><span className="kicker">SELLER ORDER</span><h2>{order.order_number}</h2></div><div className="shipment-order-badges"><span className="pill">Payment: {order.payment_status ?? 'pending'}</span><span className="pill">{order.fulfillment_status}</span></div></div>
          {!shipments.length ? <ShipmentCreateForm disabled={create.isPending} riders={riderOptions} allowPendingCod={Boolean(cod)} onSubmit={(input) => create.mutate({ sellerOrderId: order.id, input })} /> : <div className="shipment-order-items">{shipments.map((shipment) => <div className="shipment-list-row" key={shipment.id}><div><strong>{shipment.delivery_method === 'self_delivery' ? 'Self delivery' : shipment.carrier ?? 'External courier'}</strong><small>{shipment.internal_tracking_id ?? shipment.tracking_number ?? `Shipment #${shipment.id}`} · Created {formatDate(shipment.created_at)}</small></div><span className="pill">{shipment.status}</span><Link className="button secondary" to={`/seller/shipments/${shipment.id}`}>View details</Link></div>)}</div>}
        </div>
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
  const query = useQuery({ queryKey: ['seller-shipment', id], queryFn: () => sellerRequest<Shipment>('GET', `/seller/shipments/${id}`), enabled: Boolean(id) })
  const update = useMutation({ mutationFn: (status: string) => sellerRequest<Shipment>('PATCH', `/seller/shipments/${id}/status`, { status }), onSuccess: () => { client.invalidateQueries({ queryKey: ['seller-shipment', id] }); client.invalidateQueries({ queryKey: ['seller-fulfillment'] }) }, retry: 0 })
  if (query.isLoading) return <div className="card loading">Loading shipment details…</div>
  if (query.isError || !query.data) return <ErrorBox message={apiErrorMessage(query.error ?? new Error('Shipment not found.'))} />
  const shipment = query.data
  const trackingNumber = shipment.internal_tracking_id ?? shipment.tracking_number ?? ''
  const trackingUrl = safeTrackingUrl(shipment.metadata?.tracking_url)
  const nextStatuses = transitions[shipment.status] ?? []
  const notice = (location.state as { notice?: string } | null)?.notice
  return <div className="shipment-details-page">
    {notice ? <div className="success shipment-notice"><Check size={17} />{notice}</div> : null}
    <div className="shipment-details-topbar"><Link className="product-back-link" to="/seller/fulfillment"><ArrowLeft size={16} /> Back to fulfillment</Link><span className="pill">{shipment.status}</span></div>
    <div className="page-title"><div><span className="kicker">SHIPMENT DETAILS</span><h1>{shipment.internal_tracking_id ?? `Shipment #${shipment.id}`}</h1><p>{shipment.seller_order?.order_number ?? shipment.order?.order_number ?? 'Seller order'} · Created {formatDate(shipment.created_at)}</p></div><Truck size={30} /></div>
    <div className="shipment-details-grid">
      <section className="card shipment-summary-card"><h2>Shipment summary</h2><div className="shipment-meta-grid"><Meta label="Shipment ID" value={`#${shipment.id}`} /><Meta label="Delivery method" value={shipment.delivery_method === 'self_delivery' ? 'Self delivery' : 'External courier'} /><Meta label="Carrier" value={shipment.carrier ?? '—'} /><Meta label="Tracking number" value={trackingNumber || 'Not provided'} /><Meta label="Assigned rider" value={shipment.rider?.name ?? 'Not assigned'} /><Meta label="Created" value={formatDate(shipment.created_at)} /><Meta label="Shipped" value={formatDate(shipment.shipped_at)} /><Meta label="Delivered" value={formatDate(shipment.delivered_at)} /></div>{trackingNumber ? <div className="shipment-tracking-actions"><button className="button secondary" type="button" onClick={async () => { try { await navigator.clipboard.writeText(trackingNumber); setCopyState('Copied') } catch { setCopyState('Copy unavailable') } }}><Clipboard size={16} />{copyState}</button>{trackingUrl ? <a className="button" href={trackingUrl} target="_blank" rel="noreferrer"><ExternalLink size={16} />Track package</a> : null}</div> : null}</section>
      <section className="card shipment-status-card"><h2>Update status</h2><p className="muted">Each update is validated by Laravel and added to the shipment history.</p><select className="select" value="" onChange={(event) => { if (event.target.value) update.mutate(event.target.value) }} disabled={update.isPending || !nextStatuses.length}><option value="">{nextStatuses.length ? 'Choose next status' : 'No further status available'}</option>{nextStatuses.map((status) => <option key={status} value={status}>{status.replaceAll('_', ' ')}</option>)}</select>{update.isPending ? <p className="muted">Saving status…</p> : null}{update.isError ? <ErrorBox message={apiErrorMessage(update.error)} /> : null}</section>
    </div>
    <section className="card shipment-timeline-card"><h2>Tracking history</h2>{shipment.tracking?.length ? <div className="shipment-timeline">{shipment.tracking.map((event) => <div className="shipment-timeline-event" key={event.id}><span className="timeline-dot" /><div><strong>{event.status.replaceAll('_', ' ')}</strong><small>{formatDate(event.occurred_at)} · {event.source ?? 'manual'}{event.actor?.name ? ` · ${event.actor.name}` : ''}</small>{event.message ? <p>{event.message}</p> : null}{event.location ? <small>{event.location}</small> : null}</div></div>)}</div> : <p className="muted">No tracking events recorded.</p>}</section>
    {shipment.items?.length ? <section className="card shipment-items-card"><h2>Products in this shipment</h2>{shipment.items.map((item, index) => <div className="shipment-list-row" key={`${item.order_item?.sku ?? 'item'}-${index}`}><span>{item.order_item?.product_name ?? 'Product'}<small>{item.order_item?.sku ?? 'SKU unavailable'}</small></span><strong>× {item.quantity}</strong></div>)}</section> : null}
  </div>
}

function Meta({ label, value }: { label: string; value: string }) {
  return <div className="shipment-meta"><span>{label}</span><strong>{value}</strong></div>
}

function apiErrorMessage(error: unknown) {
  if (error instanceof ApiClientError) {
    const details = Object.entries(error.errors ?? {}).map(([field, messages]) => `${field}: ${messages.join(' ')}`).join(' ')
    return details ? `${error.message}: ${details}` : error.message
  }
  return error instanceof Error ? error.message : 'Something went wrong. Please try again.'
}

function PageTitle({ title, subtitle }: { title: string; subtitle: string }) {
  return <div className="page-title"><div><h1>{title}</h1><p>{subtitle}</p></div></div>
}

function ErrorBox({ message }: { message: string }) {
  return <div className="error block">{message}</div>
}
