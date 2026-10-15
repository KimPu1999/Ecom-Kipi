import { ArrowLeft, Trash2 } from 'lucide-react'
import { Link } from 'react-router-dom'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useAuthStore } from '../store/auth'
import { storefrontApi } from '../services/storefrontApi'
import { Card, EmptyState, ErrorState, LoadingState, PageIntro, PriceDisplay, QuantitySelector } from '../components/StorefrontUI'
import type { CartItem } from '../types/storefront'

export function CartPage() {
  const user = useAuthStore((state) => state.user)
  const client = useQueryClient()
  const query = useQuery({ queryKey: ['cart'], queryFn: storefrontApi.cart, enabled: Boolean(user) })
  const update = useMutation({ mutationFn: ({ id, quantity }: { id: number; quantity: number }) => storefrontApi.updateCartItem(id, quantity), onSuccess: () => client.invalidateQueries({ queryKey: ['cart'] }) })
  const remove = useMutation({ mutationFn: storefrontApi.removeCartItem, onSuccess: () => client.invalidateQueries({ queryKey: ['cart'] }) })
  const changeVariant = useMutation({ mutationFn: async ({ itemId, variantId, quantity }: { itemId: number; variantId: number; quantity: number }) => { await storefrontApi.removeCartItem(itemId); return storefrontApi.addCartItem(variantId, quantity) }, onSuccess: () => client.invalidateQueries({ queryKey: ['cart'] }) })
  if (!user) return <div className="narrow-page"><EmptyState title="Your cart is waiting" message="Sign in to keep your cart connected to your account." action={<Link className="button primary" to="/login?next=%2Fcart">Sign in to shop</Link>} /></div>
  if (query.isLoading) return <LoadingState />
  if (query.isError || !query.data) return <ErrorState message="We could not load your cart." />
  const cart = query.data.data
  if (!cart.items.length) return <div className="narrow-page"><EmptyState title="Your cart is empty" message="There is plenty of room for something good." action={<Link className="button primary" to="/products">Continue shopping</Link>} /></div>
  return <div className="cart-page"><PageIntro eyebrow="Your basket" title="A few good things." description="Review your items before moving to checkout." /><div className="cart-layout"><div className="cart-items">{cart.items.map((item) => <Card className="cart-item" key={item.id}><div className="cart-thumb">{item.variant.product.name.slice(0, 1)}</div><div className="cart-item-copy"><Link to={'/products/' + item.variant.product.slug}><h2>{item.variant.product.name}</h2></Link><p>{item.variant.attributes ? Object.entries(item.variant.attributes).map(([key, value]) => `${key}: ${value}`).join(' · ') : item.variant.sku}</p><PriceDisplay amount={item.variant.price_minor} currency={item.variant.currency} /></div><QuantitySelector value={item.quantity} max={1000} disabled={update.isPending} onChange={(quantity) => update.mutate({ id: item.id, quantity })} /><div className="cart-line-total">{item.line_total_minor.toLocaleString()} {item.variant.currency}</div><button className="icon-button danger" onClick={() => remove.mutate(item.id)} disabled={remove.isPending} aria-label={'Remove ' + item.variant.product.name}><Trash2 size={18} /></button></Card>)}</div><Card className="cart-summary"><span className="eyebrow">Summary</span><h2>Your order</h2><div className="summary-row"><span>Subtotal · {cart.item_count} items</span><strong>{cart.subtotal_minor.toLocaleString()} {cart.items[0]?.variant.currency ?? 'MMK'}</strong></div><p className="muted">Shipping and taxes are calculated in checkout.</p><Link className="button primary full" to="/checkout">Proceed to checkout</Link><Link className="continue-link" to="/products"><ArrowLeft size={15} /> Continue shopping</Link></Card></div></div>
}

function CartVariantSelector({ item, disabled, onChange }: { item: CartItem; disabled: boolean; onChange: (variantId: number) => void }) {
  const variants = item.variant.product.variants ?? []
  if (variants.length < 2) return <p>{item.variant.attributes ? Object.entries(item.variant.attributes).map(([key, value]) => `${key}: ${value}`).join(' · ') : item.variant.sku}</p>
  return <label className="cart-variant-selector">Option<select value={item.variant.id} disabled={disabled} onChange={(event) => onChange(Number(event.target.value))}>{variants.map((variant) => <option value={variant.id} disabled={!variant.is_active || variant.available_quantity < 1} key={variant.id}>{Object.entries(variant.attributes ?? {}).map(([key, value]) => `${key}: ${value}`).join(' · ') || variant.sku}{variant.available_quantity < 1 ? ' · Out of stock' : ''}</option>)}</select></label>
}
