import { useEffect, useRef, useState } from 'react'
import { ArrowLeft, FileText, Printer } from 'lucide-react'
import { useQuery } from '@tanstack/react-query'
import { useNavigate, useParams, useSearchParams } from 'react-router-dom'
import { ErrorState, LoadingState } from '../components/ui'
import { adminApi } from '../services/adminApi'
import type { Order } from '../types/admin'
import './invoice.css'

function formatMoney(value: number | null | undefined, currency: string) {
  return value === null || value === undefined ? '—' : `${value.toLocaleString()} ${currency}`
}

function formatDateTime(value: string | null | undefined) {
  return value ? new Date(value).toLocaleString() : '—'
}

function formatStatus(value: string | null | undefined) {
  if (!value) return 'Not available'
  return value.replaceAll('_', ' ').replace(/\b\w/g, (letter) => letter.toUpperCase())
}

function statusClass(value: string | null | undefined) {
  return `invoice-status-${(value ?? 'unknown').replaceAll('_', '-').toLowerCase()}`
}

function formatAttributes(attributes: Record<string, unknown> | null | undefined) {
  if (!attributes) return ''
  return Object.entries(attributes)
    .filter(([, value]) => value !== null && value !== undefined && value !== '')
    .map(([key, value]) => `${key}: ${String(value)}`)
    .join(' · ')
}

function addressLines(address: Record<string, unknown> | null | undefined) {
  if (!address) return ['Not provided']
  const keys = ['name', 'recipient_name', 'phone', 'contact_phone', 'mobile', 'line1', 'address', 'address_line_1', 'line2', 'address_line_2', 'street', 'street_address', 'ward', 'district', 'township', 'city', 'state', 'postal_code', 'country']
  const values: string[] = []
  for (const key of [...keys, ...Object.keys(address).filter((key) => !keys.includes(key))]) {
    const value = address[key]
    if ((typeof value === 'string' || typeof value === 'number') && String(value).trim() && !values.includes(String(value))) values.push(String(value))
  }
  return values.length ? values : ['Not provided']
}

function paymentReference(payment: NonNullable<Order['payments']>[number] | undefined) {
  if (!payment) return 'Not available'
  if (payment.provider_payment_id) return payment.provider_payment_id
  const metadata = payment.metadata ?? {}
  for (const key of ['transaction_code', 'transaction_reference', 'reference_id']) {
    if (typeof metadata[key] === 'string' && metadata[key]) return metadata[key] as string
  }
  return 'Not available'
}

function trackingUrl(shipment: NonNullable<Order['shipments']>[number] | undefined) {
  const value = shipment?.metadata?.tracking_url
  if (typeof value !== 'string' || !/^https?:\/\//i.test(value)) return null
  return value
}

function InvoiceStatus({ value }: { value: string | null | undefined }) {
  return <span className={`invoice-status ${statusClass(value)}`}>{formatStatus(value)}</span>
}

export function InvoicePage() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()
  const orderId = Number(id)
  const validOrderId = Number.isSafeInteger(orderId) && orderId > 0
  const autoPrint = searchParams.get('print') === '1'
  const printTriggered = useRef(false)
  const [issuedAt] = useState(() => new Date())
  const query = useQuery({ queryKey: ['admin-invoice', orderId], queryFn: () => adminApi.order(orderId), enabled: validOrderId })

  useEffect(() => {
    document.body.classList.add('printing-invoice-route')
    return () => document.body.classList.remove('printing-invoice-route')
  }, [])

  useEffect(() => {
    if (!query.data || !autoPrint || printTriggered.current || typeof window === 'undefined') return
    printTriggered.current = true
    const timer = window.setTimeout(() => window.print(), 0)
    return () => window.clearTimeout(timer)
  }, [autoPrint, query.data])

  if (!validOrderId) return <div className="invoice-state"><ErrorState message="Invoice could not be found." /></div>
  if (query.isLoading) return <div className="invoice-state"><LoadingState /></div>
  if (query.isError || !query.data) return <div className="invoice-state"><ErrorState message="Unable to load the invoice. Refresh and try again." /></div>

  const order = query.data
  const primaryPayment = order.payments?.[0]
  const primaryShipment = order.shipments?.[0]
  const paid = order.payment_status === 'paid'
  const invoiceNumber = `INV-${order.order_number}`
  const customerAddress = addressLines(order.shipping_address)
  const trackingNumbers = order.shipments?.map((shipment) => shipment.tracking_number ?? shipment.internal_tracking_id).filter((value): value is string => Boolean(value)) ?? []
  const trackingLink = trackingUrl(primaryShipment)

  return <div className="invoice-page">
    <div className="invoice-toolbar no-print">
      <button className="button secondary" type="button" onClick={() => navigate(`/admin/orders/${order.id}`)}><ArrowLeft size={16} aria-hidden="true" />Back to order</button>
      <div className="invoice-toolbar-actions">
        <span className="invoice-toolbar-note">Use the print dialog to print or save this invoice as PDF.</span>
        <button className="button primary" type="button" onClick={() => window.print()}><Printer size={16} aria-hidden="true" />Print invoice</button>
      </div>
    </div>

    <article className="invoice-sheet" aria-labelledby="invoice-title">
      <header className="invoice-header">
        <div className="invoice-brand"><span className="invoice-brand-mark">T</span><div><strong>THANGPC</strong><span>Marketplace</span></div></div>
        <div className="invoice-title-block"><span className="invoice-eyebrow">Order document</span><h1 id="invoice-title">Invoice</h1><p>{invoiceNumber}</p></div>
      </header>

      <div className="invoice-meta-grid">
        <div className="invoice-info-block"><span className="invoice-label">Invoice number</span><strong>{invoiceNumber}</strong><span className="invoice-label">Order number</span><strong>{order.order_number}</strong></div>
        <div className="invoice-info-block"><span className="invoice-label">Order date</span><strong>{formatDateTime(order.placed_at)}</strong><span className="invoice-label">Invoice issue date</span><strong>{formatDateTime(issuedAt.toISOString())}</strong></div>
        <div className="invoice-info-block"><span className="invoice-label">Payment status</span><InvoiceStatus value={order.payment_status} />{paid ? <small>Payment verified. This invoice reflects a paid order.</small> : <small>Payment is not confirmed. This document is not a payment receipt.</small>}</div>
      </div>

      <div className="invoice-address-grid">
        <section className="invoice-section invoice-address-section"><h2>Bill to</h2><strong>{order.user?.name ?? 'Guest customer'}</strong>{order.user?.email ? <span>{order.user.email}</span> : null}{order.user?.phone ? <span>{order.user.phone}</span> : null}</section>
        <section className="invoice-section invoice-address-section"><h2>Ship to</h2>{customerAddress.map((line) => <span key={line}>{line}</span>)}</section>
      </div>

      <section className="invoice-section invoice-items-section"><div className="invoice-section-heading"><h2>Order items</h2><span>{order.items?.length ?? 0} item{order.items?.length === 1 ? '' : 's'}</span></div><div className="invoice-table-wrap"><table className="invoice-items-table"><thead><tr><th>Item</th><th>SKU / Variant</th><th>Qty</th><th>Unit price</th><th>Line total</th></tr></thead><tbody>{order.items?.length ? order.items.map((item, index) => <tr key={item.id ?? `${item.sku}-${index}`}><td><strong>{item.product_name}</strong>{item.attributes ? <small>{formatAttributes(item.attributes)}</small> : null}</td><td>{item.sku || '—'}</td><td>{item.quantity}</td><td>{formatMoney(item.unit_price_minor, order.currency)}</td><td><strong>{formatMoney(item.line_total_minor ?? item.unit_price_minor * item.quantity, order.currency)}</strong></td></tr>) : <tr><td colSpan={5}>No order items recorded.</td></tr>}</tbody></table></div></section>

      <div className="invoice-lower-grid">
        <div className="invoice-lower-main">
          <section className="invoice-section"><div className="invoice-section-heading"><h2>Payment information</h2><InvoiceStatus value={order.payment_status} /></div><dl className="invoice-details-list"><div><dt>Payment method</dt><dd>{primaryPayment?.provider?.replaceAll('_', ' ').toUpperCase() ?? 'Not available'}</dd></div><div><dt>Payment reference</dt><dd>{paymentReference(primaryPayment)}</dd></div><div><dt>Amount recorded</dt><dd>{formatMoney(primaryPayment?.amount_minor, primaryPayment?.currency ?? order.currency)}</dd></div></dl><p className="invoice-payment-note">{paid ? 'Payment has been verified by an authorized administrator or supported payment workflow.' : 'Payment remains pending or unpaid. Printing this invoice does not confirm payment.'}</p></section>
          <section className="invoice-section"><div className="invoice-section-heading"><h2>Shipping and delivery</h2><InvoiceStatus value={order.fulfillment_status} /></div><dl className="invoice-details-list"><div><dt>Shipping method</dt><dd>{order.shipping_method?.name ?? primaryShipment?.delivery_method?.replaceAll('_', ' ') ?? 'Not available'}</dd></div><div><dt>Carrier</dt><dd>{primaryShipment?.carrier ?? 'Not available'}</dd></div><div><dt>Tracking number</dt><dd>{trackingNumbers.length ? trackingNumbers.join(', ') : 'Not available'}</dd></div><div><dt>Estimated delivery</dt><dd>{primaryShipment?.estimated_delivery_at ? formatDateTime(primaryShipment.estimated_delivery_at) : 'Not available'}</dd></div></dl>{trackingLink ? <a className="invoice-tracking-link" href={trackingLink} target="_blank" rel="noreferrer">Open tracking link</a> : null}</section>
        </div>
        <section className="invoice-section invoice-summary-section"><div className="invoice-section-heading"><h2>Order summary</h2><FileText size={17} aria-hidden="true" /></div><dl className="invoice-summary-list"><div><dt>Subtotal</dt><dd>{formatMoney(order.subtotal_minor, order.currency)}</dd></div><div><dt>Discount</dt><dd>{formatMoney(order.discount_minor, order.currency)}</dd></div><div><dt>Shipping fee</dt><dd>{formatMoney(order.shipping_minor, order.currency)}</dd></div><div><dt>Tax</dt><dd>{formatMoney(order.tax_minor, order.currency)}</dd></div><div className="invoice-total"><dt>Grand total</dt><dd>{formatMoney(order.grand_total_minor, order.currency)}</dd></div></dl></section>
      </div>

      <footer className="invoice-footer"><span>THANGPC Marketplace</span><span>Generated from the selected order's authorized records. Invoice number remains stable when reprinted.</span></footer>
    </article>
  </div>
}
