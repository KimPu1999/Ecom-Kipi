import { Link, useSearchParams } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { storefrontApi } from '../services/storefrontApi'
import { Card, ErrorState, LoadingState, StatusBadge } from '../components/StorefrontUI'

export function CheckoutPendingPage() {
  const [params] = useSearchParams()
  const query = useQuery({ queryKey: ['order', params.get('order')], queryFn: () => storefrontApi.order(params.get('order') ?? ''), enabled: Boolean(params.get('order')) })
  if (query.isLoading) return <LoadingState />
  if (query.isError || !query.data) return <ErrorState message="We could not verify the pending order." />
  const order = query.data.data
  return <ResultCard eyebrow="Payment pending" title="We are waiting for payment confirmation." message="Your order exists, but it is not marked paid until Stripe sends a verified webhook. Refresh this page after completing payment in the provider flow." order={order} />
}

export function CheckoutSuccessPage() {
  const [params] = useSearchParams()
  const query = useQuery({ queryKey: ['order', params.get('order')], queryFn: () => storefrontApi.order(params.get('order') ?? ''), enabled: Boolean(params.get('order')) })
  if (query.isLoading) return <LoadingState />
  if (query.isError || !query.data) return <ErrorState />
  const order = query.data.data
  if (order.payment_status !== 'paid') return <ResultCard eyebrow="Still verifying" title="Payment has not been verified yet." message="This URL is not proof of payment. The order remains safe while we wait for the provider webhook." order={order} />
  return <ResultCard eyebrow="Payment confirmed" title="Thank you for your order." message="Your payment was verified by the payment provider." order={order} />
}

export function CheckoutCancelPage() {
  return <ResultCard eyebrow="Payment canceled" title="No payment was completed." message="Your order remains pending and no successful payment was recorded. You can return to the order or continue shopping." />
}

function ResultCard({ eyebrow, title, message, order }: { eyebrow: string; title: string; message: string; order?: { id: number; order_number: string; payment_status: string; grand_total_minor: number; currency: string } }) {
  return <section className="narrow-page"><Card className="result-card"><span className="eyebrow">{eyebrow}</span><h1>{title}</h1><p className="muted">{message}</p>{order ? <div className="result-order"><span>{order.order_number}</span><StatusBadge value={order.payment_status} /><strong>{order.grand_total_minor.toLocaleString()} {order.currency}</strong></div> : null}<div className="actions"><Link className="button primary" to={order ? '/account/orders/' + order.id : '/products'}>{order ? 'View order' : 'Continue shopping'}</Link><Link className="button secondary" to="/products">Shop more</Link></div></Card></section>
}
