import { useEffect, type MouseEvent, type PropsWithChildren, type ReactNode } from 'react'
import { AlertCircle, ChevronLeft, ChevronRight, Heart, LoaderCircle, Minus, Plus, Search, ShoppingBag } from 'lucide-react'
import { Link, useNavigate } from 'react-router-dom'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useAuthStore } from '../store/auth'
import { storefrontApi } from '../services/storefrontApi'
import type { Product } from '../types/storefront'
import { useLanguage } from '../../../../packages/i18n/src'

export function Seo({ title, description }: { title: string; description: string }) {
  useEffect(() => {
    document.title = `${title} · Kipi Commerce`
    const meta = document.querySelector('meta[name="description"]') ?? document.createElement('meta')
    meta.setAttribute('name', 'description')
    meta.setAttribute('content', description)
    document.head.appendChild(meta)
  }, [description, title])
  return null
}

export function LoadingState({ label = 'Loading…' }: { label?: string }) {
  return <div className="feedback" role="status"><LoaderCircle className="spin" size={22} />{label}</div>
}

export function ErrorState({ message = 'We could not load this right now.' }: { message?: string }) {
  return <div className="feedback error-box" role="alert"><AlertCircle size={21} />{message}</div>
}

export function EmptyState({ title, message, action }: { title: string; message: string; action?: ReactNode }) {
  return <div className="empty-state"><div className="empty-icon">✦</div><h2>{title}</h2><p>{message}</p>{action}</div>
}

export function PageIntro({ title }: { eyebrow: string; title: string; description?: string }) {
  return <h1 className="visually-hidden">{title}</h1>
}

export function Breadcrumbs({ items }: { items: { label: string; to?: string }[] }) {
  return <nav className="breadcrumbs" aria-label="Breadcrumb">{items.map((item, index) => <span key={item.label}>{item.to ? <Link to={item.to}>{item.label}</Link> : item.label}{index < items.length - 1 ? <b>/</b> : null}</span>)}</nav>
}

export function ProductCard({ product, actionLabel = 'Quick add' }: { product: Product; actionLabel?: string }) {
  const navigate = useNavigate()
  const client = useQueryClient()
  const user = useAuthStore((state) => state.user)
  const { t } = useLanguage()
  const image = product.images?.[0]
  const variant = product.variants?.[0]
  const discount = variant?.compare_at_price_minor && variant.compare_at_price_minor > variant.price_minor ? Math.round((1 - variant.price_minor / variant.compare_at_price_minor) * 100) : null
  const sellerTone = product.seller ? ` seller-tone-${(product.seller.id % 4) + 1}` : ''
  const wishlist = useQuery({ queryKey: ['wishlist'], queryFn: storefrontApi.wishlist, enabled: Boolean(user) })
  const saved = wishlist.data?.data.product_ids.includes(product.id) ?? false
  const wishlistMutation = useMutation({ mutationFn: () => saved ? storefrontApi.removeWishlist(product.id) : storefrontApi.addWishlist(product.id), onSuccess: () => client.invalidateQueries({ queryKey: ['wishlist'] }) })
  const cartMutation = useMutation({ mutationFn: () => storefrontApi.addCartItem(variant?.id ?? 0, 1), onSuccess: () => client.invalidateQueries({ queryKey: ['cart'] }) })
  function openWishlist(event: MouseEvent<HTMLButtonElement>) { event.preventDefault(); event.stopPropagation(); if (!user) { navigate('/login?next=' + encodeURIComponent('/products/' + product.slug)); return } wishlistMutation.mutate() }
  function quickAdd(event: MouseEvent<HTMLButtonElement>) { event.preventDefault(); event.stopPropagation(); if (!user) { navigate('/login?next=' + encodeURIComponent('/products/' + product.slug)); return } if (variant?.available_quantity) cartMutation.mutate() }
  return <article className={'product-card' + sellerTone}><Link to={'/products/' + product.slug}><div className="product-image">{image ? <img src={image.url} alt={image.alt_text || product.name} loading="lazy" /> : <span>{product.name.slice(0, 1)}</span>}{product.is_featured ? <em>Featured</em> : null}{discount ? <em className="discount-badge">{discount}% {t('off')}</em> : null}<button className={saved ? 'product-action saved' : 'product-action'} onClick={openWishlist} disabled={wishlistMutation.isPending} aria-label={saved ? `Remove ${product.name} from wishlist` : `Add ${product.name} to wishlist`}><Heart size={17} fill={saved ? 'currentColor' : 'none'} /></button></div><div className="product-card-body"><div><span className="seller-badge">{product.seller?.store_name ?? 'Kipi collection'}</span><h3>{product.name}</h3><p>{product.category?.name ?? 'Everyday favorite'}</p></div>{variant ? <PriceDisplay amount={variant.price_minor} currency={variant.currency} compareAt={variant.compare_at_price_minor} /> : <span className="muted">Unavailable</span>}</div></Link><div className="product-card-footer">{variant?.available_quantity ? <span className="stock-note">In stock</span> : <span className="stock-note out">Unavailable</span>}<button className="quick-add" onClick={quickAdd} disabled={!variant?.available_quantity || cartMutation.isPending} aria-label={`Add ${product.name} to cart`}>{cartMutation.isPending ? <LoaderCircle className="spin" size={15} /> : <ShoppingBag size={15} />} {actionLabel}</button></div></article>
}

export function PriceDisplay({ amount, currency, compareAt }: { amount: number; currency: string; compareAt?: number | null }) {
  return <span className="price"><strong>{amount.toLocaleString()} {currency}</strong>{compareAt ? <del>{compareAt.toLocaleString()} {currency}</del> : null}</span>
}

export function QuantitySelector({ value, onChange, max = 999, disabled = false }: { value: number; onChange: (value: number) => void; max?: number; disabled?: boolean }) {
  return <div className="quantity"><button type="button" aria-label="Decrease quantity" disabled={disabled || value <= 1} onClick={() => onChange(Math.max(1, value - 1))}><Minus size={15} /></button><output>{value}</output><button type="button" aria-label="Increase quantity" disabled={disabled || value >= max} onClick={() => onChange(Math.min(max, value + 1))}><Plus size={15} /></button></div>
}

export function Pagination({ page, pages, onChange }: { page: number; pages: number; onChange: (page: number) => void }) {
  if (pages <= 1) return null
  return <div className="pagination"><button disabled={page <= 1} onClick={() => onChange(page - 1)} aria-label="Previous page"><ChevronLeft size={18} /></button><span>Page {page} of {pages}</span><button disabled={page >= pages} onClick={() => onChange(page + 1)} aria-label="Next page"><ChevronRight size={18} /></button></div>
}

export function SearchInput({ value, onChange, placeholder = 'Search products' }: { value: string; onChange: (value: string) => void; placeholder?: string }) {
  return <label className="search-input"><Search size={18} /><input value={value} onChange={(event) => onChange(event.target.value)} placeholder={placeholder} aria-label={placeholder} /></label>
}

export function Card({ children, className = '', id }: PropsWithChildren<{ className?: string; id?: string }>) {
  return <section className={'surface-card ' + className} id={id}>{children}</section>
}

export function StatusBadge({ value }: { value: string }) {
  return <span className={'status-badge status-' + value.replaceAll('_', '-')}>{value.replaceAll('_', ' ')}</span>
}
