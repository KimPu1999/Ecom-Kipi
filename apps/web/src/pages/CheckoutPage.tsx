import { useState } from 'react'
import type { FormEvent } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { CardElement, Elements, useElements, useStripe } from '@stripe/react-stripe-js'
import { loadStripe } from '@stripe/stripe-js'
import { storefrontApi } from '../services/storefrontApi'
import type { Address } from '../types/storefront'
import { Card, EmptyState, ErrorState, LoadingState, PageIntro, StatusBadge } from '../components/StorefrontUI'

const stripePromise = import.meta.env.VITE_STRIPE_PUBLISHABLE_KEY
  ? loadStripe(import.meta.env.VITE_STRIPE_PUBLISHABLE_KEY)
  : null

export function CheckoutPage() {
  const client = useQueryClient()
  const addresses = useQuery({ queryKey: ['addresses'], queryFn: storefrontApi.addresses })
  const cart = useQuery({ queryKey: ['cart'], queryFn: storefrontApi.cart })
  const shipping = useQuery({ queryKey: ['shipping-methods'], queryFn: storefrontApi.shippingMethods })
  const [selectedId, setSelectedId] = useState<number | null>(null)
  const [methodId, setMethodId] = useState<number | null>(null)
  const [couponInput, setCouponInput] = useState('')
  const [couponCode, setCouponCode] = useState('')
  const selected = addresses.data?.data.find((address) => address.id === (selectedId ?? addresses.data.data.find((item) => item.is_default)?.id))
  const method = shipping.data?.data.find((item) => item.id === (methodId ?? shipping.data.data[0]?.id))
  const preview = useQuery({ queryKey: ['checkout-preview', method?.id, couponCode], queryFn: () => storefrontApi.checkoutPreview(method?.id, couponCode || undefined), enabled: Boolean(cart.data?.data.item_count && method?.id) })
  const [paymentError, setPaymentError] = useState('')
  const [pendingOrderId, setPendingOrderId] = useState<number | null>(null)
  const [clientSecret, setClientSecret] = useState<string | null>(null)
  const confirm = useMutation({ mutationFn: () => storefrontApi.confirmCheckout({ shipping_address: selected, billing_address: selected, shipping_method_id: method?.id, coupon_code: couponCode || undefined }, crypto.randomUUID()), onSuccess: (response) => { setPendingOrderId(response.data.id); client.invalidateQueries({ queryKey: ['cart'] }); initialize.mutate(response.data.id) } })
  const initialize = useMutation({ mutationFn: (orderId: number) => storefrontApi.initializePayment(orderId, crypto.randomUUID()), onSuccess: (response) => { setClientSecret(response.data.client_secret); setPaymentError(response.data.client_secret ? '' : 'The payment provider did not return a secure payment session.') }, onError: () => setPaymentError('Your order was created as pending, but the payment provider could not be initialized. No payment was marked successful.') })
  if (addresses.isLoading || cart.isLoading || shipping.isLoading || (cart.data?.data.item_count && preview.isLoading)) return <LoadingState />
  if (addresses.isError || cart.isError || shipping.isError) return <ErrorState message="We could not prepare checkout. Please review your cart and try again." />
  if (preview.isError) { const previewError = (preview as { error?: unknown }).error; return <div className="narrow-page"><ErrorState message={previewError instanceof Error ? previewError.message : 'We could not calculate the checkout total. Please refresh and try again.'} /></div> }
  if (!cart.data?.data.item_count) return <div className="narrow-page"><EmptyState title="Nothing to check out" message="Add something to your cart before continuing." action={<Link className="button primary" to="/products">Browse products</Link>} /></div>
  if (!addresses.data?.data.length) return <div className="narrow-page"><EmptyState title="Add a delivery address" message="We need a shipping address before we can prepare this order." action={<Link className="button primary" to="/account/addresses">Manage addresses</Link>} /></div>
  return <div className="checkout-page"><PageIntro eyebrow="Checkout" title="Almost yours." description="Totals and availability are recalculated by Laravel before confirmation." /><div className="checkout-progress" aria-label="Checkout progress"><span className="active"><b>1</b> Review</span><span><b>2</b> Delivery</span><span><b>3</b> Payment</span></div><div className="checkout-trust"><strong>Secure checkout</strong><span>Your payment details are handled by Stripe. Kipi never stores raw card details.</span></div><div className="checkout-layout"><div className="checkout-main"><Card><div className="card-heading"><h2>Delivery address</h2><Link className="text-link" to="/account/addresses">Manage</Link></div><div className="address-select-list">{addresses.data.data.map((address) => <AddressChoice address={address} selected={selected?.id === address.id} onClick={() => setSelectedId(address.id)} key={address.id} />)}</div></Card><Card><div className="card-heading"><h2>Shipping method</h2></div><div className="address-select-list">{shipping.data?.data.map((item) => <button className={method?.id === item.id ? 'address-select selected' : 'address-select'} key={item.id} onClick={() => setMethodId(item.id)}><span className="radio-dot" /><div><strong>{item.name}</strong><p>{item.description || 'Reliable delivery'}</p></div><b>{item.price_minor.toLocaleString()} {item.currency}</b></button>)}</div></Card><Card><div className="card-heading"><h2>Promotion code</h2><span className="muted">Optional</span></div><div className="flex gap-2"><input value={couponInput} onChange={(event) => setCouponInput(event.target.value.toUpperCase())} placeholder="Enter coupon code" aria-label="Coupon code" /><button className="button secondary" type="button" onClick={() => setCouponCode(couponInput.trim())}>Apply</button></div>{couponCode && preview.data?.data.coupon_code ? <p className="success-box mt-3">Coupon {preview.data.data.coupon_code} applied.</p> : null}</Card>{clientSecret && stripePromise ? <Elements stripe={stripePromise} options={{ clientSecret }}><PaymentCard clientSecret={clientSecret} orderId={pendingOrderId} onError={setPaymentError} /></Elements> : <Card><div className="card-heading"><h2>Payment</h2><StatusBadge value="stripe test mode" /></div><p className="muted">Your secure payment form will appear after the order total is confirmed.</p></Card>}</div><Card className="checkout-summary"><span className="eyebrow">Order summary</span><h2>{cart.data.data.item_count} items</h2><div className="checkout-items">{cart.data.data.items.map((item) => <div className="checkout-item" key={item.id}><div><strong>{item.variant.product.name}</strong><small>{item.variant.attributes ? Object.entries(item.variant.attributes).map(([key, value]) => `: `).join(" · ") : item.variant.sku} · Qty {item.quantity}</small></div><b>{item.line_total_minor.toLocaleString()} {item.variant.currency}</b></div>)}</div><div className="summary-row"><span>Subtotal</span><strong>{preview.data?.data.subtotal_minor.toLocaleString()} {preview.data?.data.currency}</strong></div><div className="summary-row"><span>Discount</span><span>-{preview.data?.data.discount_minor.toLocaleString()} {preview.data?.data.currency}</span></div><div className="summary-row"><span>Shipping</span><span>{preview.data?.data.shipping_minor.toLocaleString()} {preview.data?.data.currency}</span></div><div className="summary-row"><span>Tax</span><span>{preview.data?.data.tax_minor.toLocaleString()} {preview.data?.data.currency}</span></div><div className="summary-total"><span>Total</span><strong>{preview.data?.data.grand_total_minor.toLocaleString()} {preview.data?.data.currency}</strong></div><button className="button primary full" disabled={!selected || !method || !preview.data || confirm.isPending || initialize.isPending || Boolean(clientSecret)} onClick={() => { setPaymentError(''); confirm.mutate() }}>{confirm.isPending || initialize.isPending ? 'Preparing secure payment…' : clientSecret ? 'Payment form ready' : 'Continue to payment'}</button>{confirm.isError ? <p className="error" role="alert">Checkout could not be confirmed. Your cart was not charged.</p> : null}{paymentError ? <p className="error" role="alert">{paymentError}</p> : null}{pendingOrderId && !clientSecret && !initialize.isPending ? <button className="button secondary full" onClick={() => initialize.mutate(pendingOrderId)}>Retry payment setup</button> : null}</Card></div></div>
}

function PaymentCard({ clientSecret, orderId, onError }: { clientSecret: string; orderId: number | null; onError: (message: string) => void }) {
  const stripe = useStripe()
  const elements = useElements()
  const [submitting, setSubmitting] = useState(false)
  const [complete, setComplete] = useState(false)
  const navigate = useNavigate()

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (!stripe || !elements || !orderId || submitting) return
    setSubmitting(true)
    onError('')
    const card = elements.getElement(CardElement)
    if (!card) {
      onError('Payment form is not ready yet.')
      setSubmitting(false)
      return
    }
    const result = await stripe.confirmCardPayment(clientSecret, { payment_method: { card } })
    if (result.error) {
      onError(result.error.message ?? 'Payment was not completed. Please try again.')
      setSubmitting(false)
      return
    }
    setComplete(true)
    navigate('/checkout/pending?order=' + orderId)
  }

  return <Card><div className="card-heading"><h2>Payment details</h2><StatusBadge value="secure Stripe test mode" /></div><p className="muted">Card details are sent directly to Stripe and are never stored by Kipi.</p><form onSubmit={submit}><div className="card"><CardElement options={{ hidePostalCode: true }} onChange={(event) => setComplete(event.complete)} /></div><button className="button primary full" disabled={!stripe || !complete || submitting}>{submitting ? 'Confirming payment…' : 'Pay securely'}</button></form></Card>
}

function AddressChoice({ address, selected, onClick }: { address: Address; selected: boolean; onClick: () => void }) {
  return <button className={selected ? 'address-select selected' : 'address-select'} onClick={onClick}><span className="radio-dot" /><div><strong>{address.label || 'Delivery address'}</strong>{address.is_default ? <StatusBadge value="default" /> : null}<p>{address.recipient_name}<br />{address.line1}, {address.city}, {address.country}</p></div></button>
}
