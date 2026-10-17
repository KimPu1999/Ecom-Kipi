import { AlertTriangle, ArrowLeft, ShieldCheck, ShoppingBag, Store, Trash2, Truck } from 'lucide-react'
import { Link } from 'react-router-dom'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { ApiClientError } from '@kipi/api-client'
import { useAuthStore } from '../store/auth'
import { storefrontApi } from '../services/storefrontApi'
import { Breadcrumbs, Card, EmptyState, ErrorState, PriceDisplay, QuantitySelector } from '../components/StorefrontUI'
import type { CartItem } from '../types/storefront'
import { useLanguage } from '../../../../packages/i18n/src'

function cartErrorMessage(error: unknown, fallback: string) {
  if (error instanceof ApiClientError) {
    const details = Object.values(error.errors ?? {}).flat().join(' ')
    return details || error.message
  }
  return error instanceof Error ? error.message : fallback
}

function formatAttributes(attributes: Record<string, string> | null | undefined) {
  return attributes ? Object.entries(attributes).map(([key, value]) => `${key}: ${value}`).join(' · ') : ''
}

function CartItemRow({ item, updating, removing, onQuantityChange, onRemove, error }: { item: CartItem; updating: boolean; removing: boolean; onQuantityChange: (quantity: number) => void; onRemove: () => void; error?: string }) {
  const { t } = useLanguage()
  const product = item.variant.product
  const image = product.images?.[0]
  const unavailable = product.status !== 'published' || !item.variant.is_active
  const stockLimited = !unavailable && item.variant.available_quantity < item.quantity
  const maxQuantity = Math.max(item.quantity, item.variant.available_quantity)
  return <article className={unavailable || stockLimited ? 'cart-item-card unavailable' : 'cart-item-card'}><div className="cart-item-media">{image ? <img src={image.url} alt={image.alt_text || product.name} /> : <span aria-hidden="true">{product.name.slice(0, 1)}</span>}</div><div className="cart-item-content"><div className="cart-item-title-row"><div><Link to={'/products/' + product.slug}><h2>{product.name}</h2></Link>{product.seller?.store_name ? <span className="cart-seller"><Store size={13} />{product.seller.store_name}</span> : null}</div><strong className="cart-item-total">{item.line_total_minor.toLocaleString()} {item.variant.currency}</strong></div><p className="cart-item-variant">{formatAttributes(item.variant.attributes) || item.variant.sku}</p>{unavailable ? <p className="cart-item-alert"><AlertTriangle size={14} />{t('This item is no longer available.')}</p> : stockLimited ? <p className="cart-item-alert"><AlertTriangle size={14} />{t('Only {count} available.', { count: item.variant.available_quantity })}</p> : null}{error ? <p className="cart-item-error" role="alert">{error}</p> : null}<div className="cart-item-controls"><div><span className="cart-item-unit-label">{t('Unit price')}</span><PriceDisplay amount={item.variant.price_minor} currency={item.variant.currency} /></div><QuantitySelector value={item.quantity} max={maxQuantity || item.quantity} disabled={updating || removing || unavailable} onChange={onQuantityChange} /><button className="text-button danger" type="button" onClick={onRemove} disabled={updating || removing} aria-label={t('Remove {product} from cart', { product: product.name })}>{removing ? t('Removing…') : <><Trash2 size={15} />{t('Remove')}</>}</button></div></div></article>
}

function CartLoading() {
  return <div className="cart-loading"><div className="cart-loading-list">{[1, 2, 3].map((item) => <div className="cart-loading-row" key={item}><span /><div><i /><i /><i /></div></div>)}</div><div className="cart-loading-summary"><i /><i /><i /><i /></div></div>
}

export function CartPage() {
  const { t } = useLanguage()
  const user = useAuthStore((state) => state.user)
  const client = useQueryClient()
  const query = useQuery({ queryKey: ['cart'], queryFn: storefrontApi.cart, enabled: Boolean(user) })
  const update = useMutation({ mutationFn: ({ id, quantity }: { id: number; quantity: number }) => storefrontApi.updateCartItem(id, quantity), onSuccess: () => client.invalidateQueries({ queryKey: ['cart'] }) })
  const remove = useMutation({ mutationFn: storefrontApi.removeCartItem, onSuccess: () => client.invalidateQueries({ queryKey: ['cart'] }) })
  if (!user) return <div className="cart-page cart-auth-state"><EmptyState title={t('Your cart is waiting')} message={t('Sign in to keep your cart connected to your account.')} action={<Link className="button primary" to="/login?next=%2Fcart">{t('Sign in to shop')}</Link>} /></div>
  if (query.isLoading) return <div className="cart-page"><CartLoading /></div>
  if (query.isError || !query.data) return <div className="cart-page cart-error-state"><ErrorState message={t('We could not load your cart.')} /><button className="button secondary" type="button" onClick={() => void query.refetch()}>{t('Retry')}</button></div>
  const cart = query.data.data
  if (!cart.items.length) return <div className="cart-page"><Breadcrumbs items={[{ label: t('Home'), to: '/' }, { label: t('Cart') }]} /><section className="cart-empty-state"><div className="cart-empty-icon"><ShoppingBag size={29} /></div><span className="eyebrow">{t('Shopping Cart')}</span><h1>{t('Your cart is empty')}</h1><p>{t('There is plenty of room for something good.')}</p><Link className="button primary" to="/products">{t('Continue shopping')}</Link></section></div>
  const unavailableItems = cart.items.filter((item) => item.variant.product.status !== 'published' || !item.variant.is_active || item.variant.available_quantity < item.quantity)
  const currency = cart.items[0]?.variant.currency ?? 'MMK'
  function removeItem(item: CartItem) { if (window.confirm(t('Remove this item?'))) remove.mutate(item.id) }
  return <div className="cart-page cart-redesign-page"><Breadcrumbs items={[{ label: t('Home'), to: '/' }, { label: t('Cart') }]} /><header className="cart-page-header"><div><span className="eyebrow">{t('Your basket')}</span><h1>{t('Shopping Cart')}</h1><p>{t('Review your items before moving to checkout.')}</p></div><div className="cart-count"><ShoppingBag size={17} /><strong>{cart.item_count}</strong><span>{t('items')}</span></div></header><div className="cart-redesign-layout"><main className="cart-items-panel"><div className="cart-items-heading"><div><span className="eyebrow">{t('Cart items')}</span><h2>{t('{count} items in your cart.', { count: cart.item_count })}</h2></div><Link className="text-link" to="/products">{t('Continue shopping')} <ArrowLeft size={14} /></Link></div>{update.isError || remove.isError ? <div className="cart-action-alert" role="alert"><AlertTriangle size={16} />{cartErrorMessage(update.error ?? remove.error, t('We could not update your cart. Please try again.'))}</div> : null}<div className="cart-item-list">{cart.items.map((item) => <CartItemRow key={item.id} item={item} updating={update.isPending && update.variables?.id === item.id} removing={remove.isPending && remove.variables === item.id} onQuantityChange={(quantity) => update.mutate({ id: item.id, quantity })} onRemove={() => removeItem(item)} error={update.isError && update.variables?.id === item.id ? cartErrorMessage(update.error, t('Quantity could not be updated.')) : remove.isError && remove.variables === item.id ? cartErrorMessage(remove.error, t('Item could not be removed.')) : undefined} />)}</div></main><aside className="cart-summary-panel"><Card className="cart-summary"><div className="cart-summary-heading"><div><span className="eyebrow">{t('Order summary')}</span><h2>{t('Your cart total')}</h2></div><ShieldCheck size={19} /></div><div className="summary-row"><span>{t('Items subtotal')} · {cart.item_count} {t('items')}</span><strong>{cart.subtotal_minor.toLocaleString()} {currency}</strong></div><div className="cart-summary-note"><Truck size={16} /><span>{t('Shipping, taxes, and eligible discounts are calculated securely at checkout.')}</span></div>{unavailableItems.length ? <div className="cart-checkout-warning"><AlertTriangle size={16} /><span>{t('Review unavailable items before checkout.')}</span></div> : null}{unavailableItems.length ? <button className="button primary full" type="button" disabled>{t('Checkout unavailable')}</button> : <Link className="button primary full" to="/checkout">{t('Proceed to checkout')}</Link>}<Link className="continue-link" to="/products"><ArrowLeft size={15} /> {t('Continue shopping')}</Link></Card></aside></div></div>
}
