import { useEffect, useState, type InputHTMLAttributes } from 'react'
import { ApiClientError } from '@kipi/api-client'
import { ArrowRight, Bell, Edit3, FileText, LogOut, MapPin, Plus, Trash2 } from 'lucide-react'
import { Link, useParams } from 'react-router-dom'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { z } from 'zod'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { profileSchema, type ProfileInput } from '@kipi/validation'
import { api } from '../lib/api'
import { useAuthStore } from '../store/auth'
import { storefrontApi } from '../services/storefrontApi'
import type { Address, Order, Shipment, TrackingEvent } from '../types/storefront'
import { Breadcrumbs, Card, EmptyState, ErrorState, LoadingState, PageIntro, Pagination, PriceDisplay, ProductCard, StatusBadge } from '../components/StorefrontUI'

const addressSchema = z.object({ label: z.string().max(80).optional(), recipient_name: z.string().min(2, 'Enter a recipient name.'), phone: z.string().min(5, 'Enter a phone number.'), line1: z.string().min(2, 'Enter an address.'), line2: z.string().optional(), city: z.string().min(2, 'Enter a city.'), state: z.string().optional(), postal_code: z.string().optional(), country: z.string().length(2, 'Use a 2-letter country code.'), is_default: z.boolean() })
type AddressInput = z.infer<typeof addressSchema>

function apiErrorMessage(error: unknown): string {
  if (error instanceof ApiClientError) {
    const details = Object.values(error.errors ?? {}).flat().join(' ')
    return details ? `${error.message}: ${details}` : error.message
  }

  return error instanceof Error ? error.message : 'The request failed. Please try again.'
}

function FormField({ label, error, ...props }: { label: string; error?: string } & InputHTMLAttributes<HTMLInputElement>) {
  return <label className="field"><span>{label}</span><input {...props} />{error ? <small className="error">{error}</small> : null}</label>
}

export function AccountPage() {
  const clear = useAuthStore((state) => state.clear)
  const query = useQuery({ queryKey: ['profile'], queryFn: storefrontApi.profile })
  const client = useQueryClient()
  const [editing, setEditing] = useState(false)
  const { register, handleSubmit, reset, formState: { errors, isSubmitting } } = useForm<ProfileInput>({ resolver: zodResolver(profileSchema) })
  useEffect(() => { if (query.data?.data) reset({ name: query.data.data.name, email: query.data.data.email, phone: query.data.data.phone ?? '' }) }, [query.data, reset])
  const mutation = useMutation({ mutationFn: storefrontApi.updateProfile, onSuccess: () => { setEditing(false); client.invalidateQueries({ queryKey: ['profile'] }) } })
  async function logout() { try { await api.auth.logout() } finally { clear(); client.clear() } }
  if (query.isLoading) return <LoadingState />
  if (query.isError || !query.data) return <ErrorState />
  const profile = query.data.data
  return <div className="account-page"><PageIntro eyebrow="Your account" title={`Hello, ${profile.name.split(' ')[0]}.`} description="Keep your details, addresses, and orders in one place." /><div className="account-layout"><Card className="profile-card"><div className="avatar">{profile.name.slice(0, 1)}</div><span className="eyebrow">Personal details</span>{editing ? <form onSubmit={handleSubmit((values) => mutation.mutate(values))}><FormField label="Name" {...register('name')} error={errors.name?.message} /><FormField label="Email" type="email" {...register('email')} error={errors.email?.message} /><FormField label="Phone" {...register('phone')} error={errors.phone?.message} /><div className="form-actions"><button className="button secondary" type="button" onClick={() => setEditing(false)}>Cancel</button><button className="button primary" disabled={isSubmitting || mutation.isPending}>Save changes</button></div></form> : <><h2>{profile.name}</h2><p>{profile.email}</p><p>{profile.phone || 'No phone number added'}</p><button className="text-link" onClick={() => setEditing(true)}><Edit3 size={15} /> Edit profile</button></>}</Card><div className="account-links"><Link className="account-link-card" to="/account/addresses"><MapPin size={22} /><span><strong>Addresses</strong><small>Manage delivery details</small></span><ArrowRight size={17} /></Link><Link className="account-link-card" to="/account/wishlist"><span><strong>Wishlist</strong><small>Saved pieces for later</small></span><ArrowRight size={17} /></Link><Link className="account-link-card" to="/account/notifications"><Bell size={22} /><span><strong>Notifications</strong><small>Order and delivery updates</small></span><ArrowRight size={17} /></Link><Link className="account-link-card" to="/account/seller-application"><FileText size={22} /><span><strong>Become a seller</strong><small>Apply for store approval</small></span><ArrowRight size={17} /></Link><Link className="account-link-card" to="/account/orders"><span><strong>Order history</strong><small>Track your Kipi purchases</small></span><ArrowRight size={17} /></Link><button className="account-link-card signout" onClick={logout}><LogOut size={20} /><span><strong>Sign out</strong><small>End this session securely</small></span></button></div></div></div>
}

export function SellerApplicationPage() {
  const client = useQueryClient()
  const applications = useQuery({ queryKey: ['seller-applications'], queryFn: storefrontApi.sellerApplications })
  const [businessName, setBusinessName] = useState('')
  const [businessType, setBusinessType] = useState('')
  const [registrationNumber, setRegistrationNumber] = useState('')
  const [contactEmail, setContactEmail] = useState('')
  const [contactPhone, setContactPhone] = useState('')
  const [document, setDocument] = useState<File | null>(null)
  const mutation = useMutation({ mutationFn: storefrontApi.submitSellerApplication, onSuccess: () => client.invalidateQueries({ queryKey: ['seller-applications'] }) })
  const current = applications.data?.data[0]
  function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const form = new FormData()
    form.append('business_name', businessName.trim())
    if (businessType.trim()) form.append('business_type', businessType.trim())
    form.append('business_details[registration_number]', registrationNumber.trim())
    form.append('contact_details[email]', contactEmail.trim())
    form.append('contact_details[phone]', contactPhone.trim())
    if (document) {
      form.append('documents[]', document)
      form.append('document_types[]', 'business_verification')
    }
    mutation.mutate(form)
  }
  if (applications.isLoading) return <LoadingState />
  if (applications.isError) return <ErrorState message={apiErrorMessage(applications.error)} />
  return <div className="account-page"><Breadcrumbs items={[{ label: 'Account', to: '/account' }, { label: 'Seller application' }]} /><PageIntro eyebrow="Marketplace" title="Become a seller." description="Submit your store and business details. Seller privileges remain disabled until a Super Admin approves your application." />{current ? <Card><div className="card-heading"><div><span className="eyebrow">Application #{current.id}</span><h2>{current.business_name}</h2></div><StatusBadge value={current.application_status} /></div>{current.rejection_reason ? <p className="error">Reason: {current.rejection_reason}</p> : null}<p className="muted">{current.documents?.length ?? 0} verification document(s) submitted. Status changes are recorded in the approval history.</p>{current.approval_history?.length ? <div className="timeline">{current.approval_history.map((item) => <div className="timeline-item" key={item.id}><span className="timeline-dot" /><div><strong>{item.to_status}</strong><small>{new Date(item.created_at).toLocaleString()}</small>{item.reason ? <p>{item.reason}</p> : null}</div></div>)}</div> : null}</Card> : <Card><form className="stack-form" onSubmit={submit}><FormField label="Store / business name" value={businessName} onChange={(event) => setBusinessName(event.target.value)} required /><FormField label="Business type" placeholder="Retail, handmade, services" value={businessType} onChange={(event) => setBusinessType(event.target.value)} /><FormField label="Registration number" value={registrationNumber} onChange={(event) => setRegistrationNumber(event.target.value)} required /><FormField label="Contact email" type="email" value={contactEmail} onChange={(event) => setContactEmail(event.target.value)} required /><FormField label="Contact phone" value={contactPhone} onChange={(event) => setContactPhone(event.target.value)} required /><label className="field"><span>Verification document</span><input type="file" accept=".pdf,.jpg,.jpeg,.png,.webp" onChange={(event) => { const selected = event.target.files?.[0] ?? null; setDocument(selected && selected.size <= 10 * 1024 * 1024 ? selected : null) }} /></label><button className="button primary" disabled={mutation.isPending || !businessName.trim() || !registrationNumber.trim() || !contactEmail.trim() || !contactPhone.trim()}>{mutation.isPending ? 'Submitting…' : 'Submit for approval'}</button>{mutation.isError ? <p className="error">{apiErrorMessage(mutation.error)}</p> : null}</form></Card>}</div>
}

export function AddressesPage() {
  const client = useQueryClient()
  const query = useQuery({ queryKey: ['addresses'], queryFn: storefrontApi.addresses })
  const [editing, setEditing] = useState<Address | null | undefined>(undefined)
  const mutation = useMutation({ mutationFn: (payload: { id?: number; data: AddressInput }) => payload.id ? storefrontApi.updateAddress(payload.id, payload.data) : storefrontApi.createAddress(payload.data), onSuccess: () => { setEditing(undefined); client.invalidateQueries({ queryKey: ['addresses'] }) } })
  const remove = useMutation({ mutationFn: storefrontApi.removeAddress, onSuccess: () => client.invalidateQueries({ queryKey: ['addresses'] }) })
  if (query.isLoading) return <LoadingState />
  if (query.isError || !query.data) return <ErrorState />
  return <div className="account-page"><Breadcrumbs items={[{ label: 'Account', to: '/account' }, { label: 'Addresses' }]} /><div className="section-heading"><PageIntro eyebrow="Account" title="Your addresses." description="Save delivery details for a smoother checkout." /><button className="button primary" onClick={() => setEditing(null)}><Plus size={17} /> Add address</button></div>{editing !== undefined ? <Card><AddressForm initial={editing} onCancel={() => setEditing(undefined)} onSubmit={(data) => mutation.mutate({ id: editing?.id, data })} /></Card> : null}{query.data.data.length ? <div className="address-grid">{query.data.data.map((address) => <Card key={address.id} className={address.is_default ? 'address-card default' : 'address-card'}><div className="address-heading"><strong>{address.label || 'Delivery address'}</strong>{address.is_default ? <StatusBadge value="default" /> : null}</div><p><b>{address.recipient_name}</b><br />{address.line1}{address.line2 ? <><br />{address.line2}</> : null}<br />{address.city}{address.state ? ', ' + address.state : ''} {address.postal_code}<br />{address.country}</p><div className="card-actions"><button className="text-link" onClick={() => setEditing(address)}><Edit3 size={15} /> Edit</button><button className="text-link danger" onClick={() => { if (window.confirm('Remove this address?')) remove.mutate(address.id) }}><Trash2 size={15} /> Remove</button></div></Card>)}</div> : <EmptyState title="No saved addresses" message="Add one to make checkout quicker." />}</div>
}

export function WishlistPage() {
  const client = useQueryClient()
  const query = useQuery({ queryKey: ['wishlist'], queryFn: storefrontApi.wishlist })
  const clear = useMutation({ mutationFn: async () => { const products = query.data?.data.products ?? []; await Promise.all(products.map((product) => storefrontApi.removeWishlist(product.id))) }, onSuccess: () => client.invalidateQueries({ queryKey: ['wishlist'] }) })
  if (query.isLoading) return <LoadingState />
  if (query.isError || !query.data) return <ErrorState message="We could not load your wishlist." />
  return <div className="account-page"><Breadcrumbs items={[{ label: 'Account', to: '/account' }, { label: 'Wishlist' }]} /><div className="section-heading"><PageIntro eyebrow="Account" title="Saved for later." description="Keep the pieces you want to come back to." />{query.data.data.products.length ? <button className="button secondary" onClick={() => clear.mutate()} disabled={clear.isPending}>Clear wishlist</button> : null}</div>{query.data.data.products.length ? <div className="product-grid">{query.data.data.products.map((product) => <ProductCard key={product.id} product={product} />)}</div> : <EmptyState title="Your wishlist is empty" message="Tap the heart on a product to save it here." action={<Link className="button primary" to="/products">Browse products</Link>} />}</div>
}

export function NotificationsPage() {
  const client = useQueryClient()
  const [page, setPage] = useState(1)
  const query = useQuery({ queryKey: ['notifications', page], queryFn: () => storefrontApi.notifications(page) })
  const read = useMutation({ mutationFn: storefrontApi.markNotificationRead, onSuccess: () => client.invalidateQueries({ queryKey: ['notifications'] }) })
  const readAll = useMutation({ mutationFn: storefrontApi.markNotificationsRead, onSuccess: () => client.invalidateQueries({ queryKey: ['notifications'] }) })
  if (query.isLoading) return <LoadingState />
  if (query.isError || !query.data) return <ErrorState message="We could not load your notifications." />
  return <div className="account-page"><Breadcrumbs items={[{ label: 'Account', to: '/account' }, { label: 'Notifications' }]} /><div className="section-heading"><PageIntro eyebrow="Account" title="Notifications." description="Order, payment, and delivery updates from Kipi." />{query.data.data.some((item) => !item.read_at) ? <button className="button secondary" onClick={() => readAll.mutate()} disabled={readAll.isPending}>Mark all read</button> : null}</div>{query.data.data.length ? <div className="grid gap-3">{query.data.data.map((item) => <button className={'card text-left ' + (!item.read_at ? 'border-primary' : '')} key={item.id} onClick={() => !item.read_at && read.mutate(item.id)}><div className="flex items-start justify-between gap-4"><div><strong>{item.data.title ?? 'Kipi update'}</strong><p className="muted mt-2">{item.data.body ?? 'You have a new account update.'}</p></div><small className="muted">{new Date(item.created_at).toLocaleString()}</small></div>{item.data.order_id ? <Link className="text-link mt-3" to={'/account/orders/' + item.data.order_id}>View order</Link> : null}</button>)}</div> : <EmptyState title="No notifications" message="Important order updates will appear here." />}<Pagination page={query.data.meta?.current_page ?? 1} pages={query.data.meta?.last_page ?? 1} onChange={setPage} /></div>
}

function AddressForm({ initial, onSubmit, onCancel }: { initial: Address | null; onSubmit: (data: AddressInput) => void; onCancel: () => void }) {
  const { register, handleSubmit, reset, formState: { errors, isSubmitting } } = useForm<AddressInput>({ resolver: zodResolver(addressSchema), defaultValues: { label: initial?.label ?? '', recipient_name: initial?.recipient_name ?? '', phone: initial?.phone ?? '', line1: initial?.line1 ?? '', line2: initial?.line2 ?? '', city: initial?.city ?? '', state: initial?.state ?? '', postal_code: initial?.postal_code ?? '', country: initial?.country ?? 'MM', is_default: initial?.is_default ?? false } })
  useEffect(() => { reset({ label: initial?.label ?? '', recipient_name: initial?.recipient_name ?? '', phone: initial?.phone ?? '', line1: initial?.line1 ?? '', line2: initial?.line2 ?? '', city: initial?.city ?? '', state: initial?.state ?? '', postal_code: initial?.postal_code ?? '', country: initial?.country ?? 'MM', is_default: initial?.is_default ?? false }) }, [initial, reset])
  return <form className="stack-form" onSubmit={handleSubmit(onSubmit)}><div className="form-grid"><FormField label="Label" placeholder="Home" {...register('label')} error={errors.label?.message} /><FormField label="Recipient name" {...register('recipient_name')} error={errors.recipient_name?.message} /><FormField label="Phone" {...register('phone')} error={errors.phone?.message} /><FormField label="Country code" maxLength={2} {...register('country')} error={errors.country?.message} /><FormField label="Address line 1" {...register('line1')} error={errors.line1?.message} /><FormField label="Address line 2" {...register('line2')} error={errors.line2?.message} /><FormField label="City" {...register('city')} error={errors.city?.message} /><FormField label="State / region" {...register('state')} error={errors.state?.message} /><FormField label="Postal code" {...register('postal_code')} error={errors.postal_code?.message} /></div><label className="checkbox"><input type="checkbox" {...register('is_default')} /> Set as default address</label><div className="form-actions"><button className="button secondary" type="button" onClick={onCancel}>Cancel</button><button className="button primary" disabled={isSubmitting}>Save address</button></div></form>
}

export function OrdersPage() {
  const [page, setPage] = useState(1)
  const query = useQuery({ queryKey: ['orders', page], queryFn: () => storefrontApi.orders(page) })
  if (query.isLoading) return <LoadingState />
  if (query.isError || !query.data) return <ErrorState />
  return <div className="account-page"><Breadcrumbs items={[{ label: 'Account', to: '/account' }, { label: 'Orders' }]} /><PageIntro eyebrow="Account" title="Order history." description="Everything you have ordered from Kipi." />{query.data.data.length ? <div className="orders-list">{query.data.data.map((order) => <OrderCard key={order.id} order={order} />)}</div> : <EmptyState title="No orders yet" message="Your next favorite thing could be just around the corner." action={<Link className="button primary" to="/products">Start shopping</Link>} />}<Pagination page={query.data.meta?.current_page ?? 1} pages={query.data.meta?.last_page ?? 1} onChange={setPage} /></div>
}

function OrderCard({ order }: { order: Order }) {
  const item = order.items?.[0]
  return <Link className="order-card" to={'/account/orders/' + order.id}>{item?.product_image ? <img className="order-thumb" src={item.product_image} alt="" /> : <div className="order-thumb placeholder">K</div>}<div><span className="eyebrow">{order.order_number}</span><h2>{item?.product_name ?? (order.placed_at ? new Date(order.placed_at).toLocaleDateString() : 'Recently placed')}</h2><small className="muted">{item?.seller?.store_name ?? 'Kipi marketplace'}{(order.items?.length ?? 0) > 1 ? ` · +${order.items!.length - 1} more item(s)` : ''}</small></div><div><StatusBadge value={order.fulfillment_status} /><strong>{order.grand_total_minor.toLocaleString()} {order.currency}</strong></div><ArrowRight size={18} /></Link>
}

export function OrderDetailPage() {
  const { id = '' } = useParams()
  const query = useQuery({ queryKey: ['order', id], queryFn: () => storefrontApi.order(id) })
  if (query.isLoading) return <LoadingState />
  if (query.isError || !query.data) return <ErrorState message="We could not find that order." />
  const order = query.data.data
  return <div className="account-page"><Breadcrumbs items={[{ label: 'Account', to: '/account' }, { label: 'Orders', to: '/account/orders' }, { label: order.order_number }]} /><PageIntro eyebrow="Order details" title={order.order_number} description={order.placed_at ? `Placed ${new Date(order.placed_at).toLocaleString()}` : undefined} /><div className="order-detail-layout"><Card><div className="order-status-head"><span>Fulfillment</span><StatusBadge value={order.fulfillment_status} /><span>Payment</span><StatusBadge value={order.payment_status} /></div><div className="timeline">{order.status_history?.map((item) => <div className="timeline-item" key={item.id}><span className="timeline-dot" /><div><strong>{item.to_status.replaceAll('_', ' ')}</strong><small>{new Date(item.created_at).toLocaleString()}</small>{item.note ? <p>{item.note}</p> : null}</div></div>)}</div>{order.items?.map((item) => <div className="order-line" key={item.id}><div><strong>{item.product_name}</strong><small>{item.sku} · Qty {item.quantity}{item.attributes ? ` · ${Object.entries(item.attributes).map(([key, value]) => `${key}: ${value}`).join(' · ')}` : ''}</small></div><PriceDisplay amount={item.line_total_minor ?? item.unit_price_minor * item.quantity} currency={order.currency} /></div>)}</Card><Card className="order-summary"><h2>Order summary</h2><SummaryRow label="Subtotal" value={order.subtotal_minor} currency={order.currency} /><SummaryRow label="Shipping" value={order.shipping_minor} currency={order.currency} /><SummaryRow label="Tax" value={order.tax_minor} currency={order.currency} /><div className="summary-total"><span>Total</span><strong>{order.grand_total_minor.toLocaleString()} {order.currency}</strong></div><h3>Delivery address</h3><p>{formatAddress(order.shipping_address)}</p><Link className="button secondary full" to={'/account/orders/' + order.id + '/tracking'}>Track shipment</Link></Card></div></div>
}

export function OrderTrackingPage() {
  const { id = '' } = useParams()
  const order = useQuery({ queryKey: ['order', id], queryFn: () => storefrontApi.order(id), enabled: Boolean(id) })
  const shipments = useQuery({ queryKey: ['shipments', id], queryFn: () => storefrontApi.shipments(id), enabled: Boolean(id) })
  if (order.isLoading || shipments.isLoading) return <LoadingState />
  if (order.isError || shipments.isError || !order.data || !shipments.data) return <ErrorState message="We could not load shipment tracking for this order." />
  const data = order.data.data
  return <div className="account-page"><Breadcrumbs items={[{ label: 'Account', to: '/account' }, { label: 'Orders', to: '/account/orders' }, { label: data.order_number, to: '/account/orders/' + data.id }, { label: 'Tracking' }]} /><PageIntro eyebrow="Shipment tracking" title={data.order_number} description="Tracking updates are read directly from the fulfillment service." />{shipments.data.data.length ? <div className="orders-list">{shipments.data.data.map((shipment) => <TrackingShipment key={shipment.id} shipment={shipment} />)}</div> : <EmptyState title="Shipment not created yet" message="Tracking will appear after the seller or operations team creates a shipment." />}</div>
}

function TrackingShipment({ shipment }: { shipment: Shipment }) {
  const tracking = useQuery({ queryKey: ['tracking', shipment.id], queryFn: () => storefrontApi.tracking(shipment.id) })
  return <Card><div className="card-heading"><div><span className="eyebrow">Shipment #{shipment.id}</span><h2>{shipment.carrier ?? 'Carrier pending'}</h2></div><StatusBadge value={shipment.status} /></div>{shipment.tracking_number ? <p className="muted">Tracking number: {shipment.tracking_number}</p> : null}{tracking.isLoading ? <LoadingState /> : tracking.data?.data.length ? <div className="timeline">{tracking.data.data.map((event: TrackingEvent) => <div className="timeline-item" key={event.id}><span className="timeline-dot" /><div><strong>{event.status.replaceAll('_', ' ')}</strong><small>{new Date(event.occurred_at).toLocaleString()}</small><p>{event.message ?? event.location ?? 'Shipment update received.'}</p></div></div>)}</div> : <p className="muted">No tracking events have been recorded yet.</p>}</Card>
}

function SummaryRow({ label, value, currency }: { label: string; value: number; currency: string }) { return <div className="summary-row"><span>{label}</span><span>{value.toLocaleString()} {currency}</span></div> }
function formatAddress(address?: Record<string, unknown>) { return address ? Object.values(address).filter(Boolean).join(', ') : 'Address unavailable.' }
