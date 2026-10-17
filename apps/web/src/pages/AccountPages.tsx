import { useEffect, useState, type InputHTMLAttributes } from 'react'
import { ApiClientError } from '@kipi/api-client'
import { ArrowLeft, ArrowRight, Bell, CalendarDays, CheckCircle2, CircleHelp, Copy, CreditCard, Edit3, FileText, Heart, LogOut, MapPin, PackageCheck, Plus, Search, ShieldCheck, ShoppingBag, SlidersHorizontal, Trash2, Truck, Upload, UserRound, X, type LucideIcon } from 'lucide-react'
import { Link, useLocation, useNavigate, useParams, useSearchParams } from 'react-router-dom'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { z } from 'zod'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { profileSchema, type ProfileInput } from '@kipi/validation'
import { api } from '../lib/api'
import { useAuthStore } from '../store/auth'
import { storefrontApi } from '../services/storefrontApi'
import type { Address, NotificationPreferences, Order, OrderSummary, Shipment, TrackingEvent } from '../types/storefront'
import { Breadcrumbs, Card, EmptyState, ErrorState, LoadingState, PageIntro, Pagination, PriceDisplay, ProductCard, StatusBadge } from '../components/StorefrontUI'
import { useLanguage } from '../../../../packages/i18n/src'

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

const accountNavigation = [
  { label: 'Overview', to: '/account', icon: UserRound },
  { label: 'Personal information', to: '/account#personal-information', icon: Edit3 },
  { label: 'My Orders', to: '/account/orders', icon: ShoppingBag },
  { label: 'Address book', to: '/account/addresses', icon: MapPin },
  { label: 'Wishlist', to: '/account/wishlist', icon: Heart },
  { label: 'Notifications', to: '/account/notifications', icon: Bell },
  { label: 'Become a seller', to: '/account/seller-application', icon: FileText },
  { label: 'Preferences', to: '/account#preferences', icon: SlidersHorizontal },
]

function AccountNavigation() {
  const { t } = useLanguage()
  const location = useLocation()
  return <nav className="account-navigation" aria-label={t('Account navigation')}><span className="eyebrow">{t('Manage your account')}</span>{accountNavigation.map((item) => { const Icon = item.icon; const active = item.to === '/account' ? location.pathname === '/account' && !location.hash : item.to.includes('#') ? location.pathname === '/account' && location.hash === '#' + item.to.split('#')[1] : location.pathname === item.to; return <Link className={active ? 'active' : ''} key={item.to} to={item.to} aria-current={active ? 'page' : undefined}><Icon size={17} /><span>{t(item.label)}</span><ArrowRight size={14} /></Link> })}</nav>
}

function AccountStatus({ value }: { value: string }) {
  const { t } = useLanguage()
  const normalized = value.toLowerCase().replaceAll('_', '-')
  const labels: Record<string, string> = { pending: 'Pending', confirmed: 'Confirmed', processing: 'Processing', shipped: 'Shipped', delivered: 'Delivered', cancelled: 'Cancelled', paid: 'Paid', failed: 'Payment failed', refunded: 'Refunded' }
  return <span className={'status-badge status-' + normalized}>{t(labels[value] ?? value.replaceAll('_', ' '))}</span>
}

function AccountStat({ icon: Icon, label, value, to }: { icon: LucideIcon; label: string; value: number | string; to: string }) {
  const { t } = useLanguage()
  return <Link className="account-stat" to={to}><span className="account-stat-icon"><Icon size={18} /></span><span><small>{t(label)}</small><strong>{value}</strong></span><ArrowRight size={15} /></Link>
}

export function AccountPage() {
  const { t } = useLanguage()
  const clear = useAuthStore((state) => state.clear)
  const client = useQueryClient()
  const profileQuery = useQuery({ queryKey: ['profile'], queryFn: storefrontApi.profile })
  const ordersQuery = useQuery({ queryKey: ['account-overview-orders'], queryFn: () => storefrontApi.orders(1) })
  const addressesQuery = useQuery({ queryKey: ['addresses'], queryFn: storefrontApi.addresses })
  const wishlistQuery = useQuery({ queryKey: ['wishlist'], queryFn: storefrontApi.wishlist })
  const preferencesQuery = useQuery({ queryKey: ['notification-preferences'], queryFn: storefrontApi.notificationPreferences })
  const [editing, setEditing] = useState(false)
  const [logoutError, setLogoutError] = useState('')
  const [loggingOut, setLoggingOut] = useState(false)
  const [preferenceDraft, setPreferenceDraft] = useState<NotificationPreferences | null>(null)
  const { register, handleSubmit, reset, formState: { errors, isSubmitting } } = useForm<ProfileInput>({ resolver: zodResolver(profileSchema) })
  useEffect(() => { if (profileQuery.data?.data) reset({ name: profileQuery.data.data.name, email: profileQuery.data.data.email, phone: profileQuery.data.data.phone ?? '' }) }, [profileQuery.data, reset])
  useEffect(() => { if (preferencesQuery.data?.data) setPreferenceDraft(preferencesQuery.data.data) }, [preferencesQuery.data])
  const profileMutation = useMutation({ mutationFn: storefrontApi.updateProfile, onSuccess: () => { setEditing(false); client.invalidateQueries({ queryKey: ['profile'] }) } })
  const preferenceMutation = useMutation({ mutationFn: storefrontApi.updateNotificationPreferences, onSuccess: (response) => { setPreferenceDraft(response.data); client.setQueryData(['notification-preferences'], response) }, onError: () => { if (preferencesQuery.data?.data) setPreferenceDraft(preferencesQuery.data.data) } })
  async function logout() { setLoggingOut(true); setLogoutError(''); try { await api.auth.logout(); clear(); client.clear() } catch (error) { setLogoutError(apiErrorMessage(error)) } finally { setLoggingOut(false) } }
  function togglePreference(key: keyof NotificationPreferences) { if (!preferenceDraft || preferenceMutation.isPending) return; const next = { ...preferenceDraft, [key]: !preferenceDraft[key] }; setPreferenceDraft(next); preferenceMutation.mutate(next) }
  if (profileQuery.isLoading) return <LoadingState />
  if (profileQuery.isError || !profileQuery.data) return <ErrorState message={t('We could not load your account.')} />
  const profile = profileQuery.data.data
  const summary = ordersQuery.data?.meta?.summary
  const activeOrders = summary ? summary.pending + summary.confirmed + summary.processing + summary.shipped : '—'
  const recentOrders = ordersQuery.data?.data.slice(0, 4) ?? []
  return <div className="account-page account-dashboard-page"><header className="account-dashboard-header"><div><span className="eyebrow">{t('Customer account')}</span><h1>{t('My Account')}</h1><p>{t('Manage your profile, orders, addresses, and preferences in one place.')}</p></div><Link className="button primary" to="/products"><ShoppingBag size={16} />{t('Continue shopping')}</Link></header><div className="account-dashboard-layout"><aside className="account-dashboard-sidebar"><div className="account-sidebar-profile"><div className="avatar">{profile.name.trim().slice(0, 1).toUpperCase()}</div><div><strong>{profile.name}</strong><small>{profile.email}</small></div></div><AccountNavigation /><Link className="account-help-link" to="/contact"><CircleHelp size={17} /><span>{t('Need help?')}</span><ArrowRight size={14} /></Link></aside><main className="account-dashboard-main"><section className="account-welcome"><div><span className="eyebrow">{t('Welcome back')}</span><h2>{t('Hello, {name}.', { name: profile.name.split(' ')[0] })}</h2><p>{t('Your account activity and saved details are ready when you are.')}</p></div><button className="text-link" type="button" onClick={() => { profileMutation.reset(); setEditing(true) }}><Edit3 size={15} />{t('Edit personal information')}</button></section><div className="account-stat-grid"><AccountStat icon={ShoppingBag} label="Total orders" value={summary?.all ?? ordersQuery.data?.meta?.total ?? '—'} to="/account/orders" /><AccountStat icon={Truck} label="Active orders" value={activeOrders} to="/account/orders" /><AccountStat icon={MapPin} label="Saved addresses" value={addressesQuery.data?.data.length ?? '—'} to="/account/addresses" /><AccountStat icon={Heart} label="Wishlist items" value={wishlistQuery.data?.data.products.length ?? '—'} to="/account/wishlist" /></div><div className="account-overview-grid"><Card className="account-profile-panel" id="personal-information"><div className="account-panel-heading"><div><span className="eyebrow">{t('Personal information')}</span><h2>{t('Your profile')}</h2></div><UserRound size={19} /></div>{editing ? <form className="stack-form" onSubmit={handleSubmit((values) => profileMutation.mutate(values))}><FormField label={t('Full name')} autoComplete="name" {...register('name')} error={errors.name?.message} /><FormField label={t('Email address')} type="email" autoComplete="email" {...register('email')} error={errors.email?.message} /><FormField label={t('Phone number')} type="tel" autoComplete="tel" {...register('phone')} error={errors.phone?.message} /><div className="form-actions"><button className="button secondary" type="button" onClick={() => { setEditing(false); profileMutation.reset() }}>{t('Cancel')}</button><button className="button primary" disabled={isSubmitting || profileMutation.isPending}>{profileMutation.isPending ? t('Saving…') : t('Save changes')}</button></div>{profileMutation.isError ? <p className="error" role="alert">{apiErrorMessage(profileMutation.error)}</p> : null}{profileMutation.isSuccess ? <p className="success-box" role="status">{t('Profile saved.')}</p> : null}</form> : <div className="account-profile-details"><div className="account-profile-large"><div className="avatar">{profile.name.trim().slice(0, 1).toUpperCase()}</div><div><strong>{profile.name}</strong><span>{profile.email}</span></div></div><dl><div><dt>{t('Phone number')}</dt><dd>{profile.phone || t('No phone number added')}</dd></div><div><dt>{t('Account status')}</dt><dd><AccountStatus value={profile.status} /></dd></div></dl><button className="button secondary" type="button" onClick={() => { profileMutation.reset(); setEditing(true) }}><Edit3 size={15} />{t('Edit profile')}</button></div>}</Card><Card className="account-recent-panel"><div className="account-panel-heading"><div><span className="eyebrow">{t('Latest activity')}</span><h2>{t('Recent orders')}</h2></div><Link className="text-link" to="/account/orders">{t('View all')} <ArrowRight size={14} /></Link></div>{ordersQuery.isLoading ? <div className="account-inline-loading"><LoadingState label={t('Loading orders')} /></div> : ordersQuery.isError ? <div className="account-inline-message"><p className="error">{t('Orders could not be loaded.')}</p><button className="text-link" type="button" onClick={() => void ordersQuery.refetch()}>{t('Retry')}</button></div> : recentOrders.length ? <div className="account-recent-orders">{recentOrders.map((order) => <div className="account-recent-order" key={order.id}><div><strong>{order.order_number}</strong><small>{order.placed_at ? new Date(order.placed_at).toLocaleDateString() : t('Date unavailable')}</small></div><div className="account-recent-order-status"><AccountStatus value={order.payment_status} /><AccountStatus value={order.fulfillment_status} /></div><strong>{order.grand_total_minor.toLocaleString()} {order.currency}</strong><Link className="text-link" to={'/account/orders/' + order.id} aria-label={t('View order {order}', { order: order.order_number })}><ArrowRight size={16} /></Link></div>)}</div> : <div className="account-inline-message"><p>{t('No orders yet.')}</p><Link className="button secondary" to="/products">{t('Start shopping')}</Link></div>}</Card></div><Card className="account-preferences-panel" id="preferences"><div className="account-panel-heading"><div><span className="eyebrow">{t('Preferences')}</span><h2>{t('Notifications and privacy')}</h2><p>{t('Choose which account updates you want to receive.')}</p></div><ShieldCheck size={19} /></div>{preferencesQuery.isLoading ? <LoadingState label={t('Loading preferences')} /> : preferencesQuery.isError || !preferenceDraft ? <p className="error">{t('Notification preferences are unavailable.')}</p> : <div className="preference-list">{([{ key: 'order_updates', label: 'Order updates', description: 'Get updates when your order changes.' }, { key: 'payment_updates', label: 'Payment updates', description: 'Get updates about payment verification.' }, { key: 'delivery_updates', label: 'Delivery updates', description: 'Get updates about shipments and delivery.' }] as const).map((item) => <button className="preference-row" type="button" key={item.key} onClick={() => togglePreference(item.key)} disabled={preferenceMutation.isPending} role="switch" aria-checked={preferenceDraft[item.key]}><span><strong>{t(item.label)}</strong><small>{t(item.description)}</small></span><span className={preferenceDraft[item.key] ? 'preference-toggle on' : 'preference-toggle'} aria-hidden="true"><span /></span></button>)}{preferenceMutation.isError ? <p className="error" role="alert">{apiErrorMessage(preferenceMutation.error)}</p> : null}{preferenceMutation.isSuccess ? <p className="success-box" role="status">{t('Preferences saved.')}</p> : null}</div>}</Card><div className="account-footer-actions"><Link className="account-footer-action" to="/account/wishlist"><Heart size={17} /><span><strong>{t('Saved products')}</strong><small>{t('Review the products you saved for later.')}</small></span><ArrowRight size={15} /></Link><button className="account-footer-action signout" type="button" onClick={() => void logout()} disabled={loggingOut}><LogOut size={17} /><span><strong>{loggingOut ? t('Signing out…') : t('Sign out')}</strong><small>{t('End this session securely.')}</small></span><ArrowRight size={15} /></button>{logoutError ? <p className="error" role="alert">{logoutError}</p> : null}</div></main></div></div>
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

function canCancelOrder(order: Order) {
  return !isCustomerConfirmed(order) && order.fulfillment_status === 'pending' && !order.cancelled_at
}

function isCustomerConfirmed(order: Order) {
  return order.customer_confirmed ?? Boolean(order.placed_at)
}

function statusLabel(value: string, t: (key: string) => string) {
  const labels: Record<string, string> = { pending: t('Pending'), confirmed: t('Confirmed'), processing: t('Processing'), shipped: t('Shipped'), delivered: t('Delivered'), cancelled: t('Cancelled'), paid: t('Paid'), failed: t('Payment failed'), refunded: t('Refunded') }
  return labels[value] ?? value.replaceAll('_', ' ')
}

export function OrdersPage() {
  const { t } = useLanguage()
  const [params, setParams] = useSearchParams()
  const navigate = useNavigate()
  const page = Math.max(1, Number(params.get('page') ?? '1') || 1)
  const q = params.get('q') ?? ''
  const fulfillmentStatus = params.get('fulfillment_status') ?? ''
  const paymentStatus = params.get('payment_status') ?? ''
  const placedFrom = params.get('placed_from') ?? ''
  const placedTo = params.get('placed_to') ?? ''
  const [searchText, setSearchText] = useState(q)
  const query = useQuery({
    queryKey: ['orders', page, q, fulfillmentStatus, paymentStatus, placedFrom, placedTo],
    queryFn: () => storefrontApi.orders(page, { q: q || undefined, fulfillment_status: fulfillmentStatus || undefined, payment_status: paymentStatus || undefined, placed_from: placedFrom || undefined, placed_to: placedTo || undefined }),
  })
  const queryClient = useQueryClient()
  const [pendingCancellationId, setPendingCancellationId] = useState<number | null>(null)
  const cancel = useMutation({ mutationFn: storefrontApi.cancelOrder, onSuccess: async () => { await Promise.allSettled([queryClient.invalidateQueries({ queryKey: ['orders'] }), queryClient.invalidateQueries({ queryKey: ['cart'] })]); queryClient.removeQueries({ queryKey: ['checkout-preview'] }); setPendingCancellationId(null); navigate('/products') }, onError: () => { queryClient.invalidateQueries({ queryKey: ['orders'] }); queryClient.invalidateQueries({ queryKey: ['cart'] }) } })
  const summary = query.data?.meta?.summary
  const hasFilters = Boolean(q || fulfillmentStatus || paymentStatus || placedFrom || placedTo)

  useEffect(() => setSearchText(q), [q])

  function updateParam(name: string, value: string) {
    const next = new URLSearchParams(params)
    if (value) next.set(name, value)
    else next.delete(name)
    next.delete('page')
    setParams(next)
  }

  function submitSearch(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()
    updateParam('q', searchText.trim())
  }

  function clearFilters() {
    setSearchText('')
    setParams({})
  }

  function cancelOrder(order: Order) {
    cancel.reset()
    setPendingCancellationId(order.id)
  }

  const statusFilters: { value: string; label: string; icon: typeof PackageCheck }[] = [
    { value: '', label: t('All'), icon: PackageCheck },
    { value: 'pending', label: t('Pending'), icon: CalendarDays },
    { value: 'confirmed', label: t('Confirmed'), icon: CheckCircle2 },
    { value: 'processing', label: t('Processing'), icon: PackageCheck },
    { value: 'shipped', label: t('Shipped'), icon: Truck },
    { value: 'delivered', label: t('Delivered'), icon: CheckCircle2 },
    { value: 'cancelled', label: t('Cancelled'), icon: X },
  ]

  return <div className="customer-orders-page">
    <Breadcrumbs items={[{ label: t('Account'), to: '/account' }, { label: t('My Orders') }]} />
    <header className="customer-orders-header"><div><span className="eyebrow">{t('Account')}</span><h1>{t('My Orders')}</h1><p>{t('View your purchases and track your orders.')}</p></div><Link className="button primary" to="/products"><ShoppingBag size={16} />{t('Start shopping')}</Link></header>
    <section className="customer-orders-toolbar" aria-label={t('Order filters')}><form className="customer-order-search" onSubmit={submitSearch}><Search size={17} /><input value={searchText} onChange={(event) => setSearchText(event.target.value)} placeholder={t('Search order number or product')} aria-label={t('Search order number or product')} />{searchText ? <button type="button" aria-label={t('Clear search')} onClick={() => { setSearchText(''); updateParam('q', '') }}><X size={15} /></button> : null}<button className="button secondary" type="submit">{t('Search')}</button></form><label className="customer-date-filter"><CalendarDays size={16} /><span>{t('From')}</span><input type="date" value={placedFrom} onChange={(event) => updateParam('placed_from', event.target.value)} /></label><label className="customer-date-filter"><span>{t('To')}</span><input type="date" value={placedTo} onChange={(event) => updateParam('placed_to', event.target.value)} /></label><select className="customer-payment-filter" value={paymentStatus} onChange={(event) => updateParam('payment_status', event.target.value)} aria-label={t('Payment status')}><option value="">{t('All payment statuses')}</option><option value="pending">{t('Payment pending')}</option><option value="paid">{t('Paid')}</option><option value="failed">{t('Payment failed')}</option><option value="cancelled">{t('Payment cancelled')}</option><option value="refunded">{t('Refunded')}</option></select>{hasFilters ? <button className="text-button" type="button" onClick={clearFilters}>{t('Clear filters')}</button> : null}</section>
    {summary ? <div className="customer-order-summary-grid">{statusFilters.map((filter) => { const Icon = filter.icon; const count = filter.value ? summary[filter.value as keyof OrderSummary] : summary.all; return <button className={fulfillmentStatus === filter.value ? 'customer-order-stat active' : 'customer-order-stat'} key={filter.value || 'all'} type="button" onClick={() => updateParam('fulfillment_status', filter.value)}><span><Icon size={16} />{filter.label}</span><strong>{count}</strong></button> })}</div> : null}
    <nav className="customer-order-tabs" aria-label={t('Order status')} role="tablist">{statusFilters.map((filter) => <button className={fulfillmentStatus === filter.value ? 'active' : ''} key={filter.value || 'all'} type="button" role="tab" aria-selected={fulfillmentStatus === filter.value} onClick={() => updateParam('fulfillment_status', filter.value)}>{filter.label}</button>)}</nav>
    {query.isLoading ? <div className="customer-order-skeletons" aria-label={t('Loading orders')}><span /><span /><span /></div> : query.isError ? <div className="customer-orders-feedback"><ErrorState message={t('Orders could not be loaded.')} /><button className="button secondary" type="button" onClick={() => query.refetch()}>{t('Retry')}</button></div> : query.data?.data.length ? <div className="customer-orders-list">{query.data.data.map((order) => <OrderCard key={order.id} order={order} onCancel={() => cancelOrder(order)} cancelling={cancel.isPending && cancel.variables === order.id} confirming={pendingCancellationId === order.id} onConfirm={() => cancel.mutate(order.id)} onCancelConfirmation={() => { cancel.reset(); setPendingCancellationId(null) }} cancellationError={cancel.variables === order.id && cancel.isError ? apiErrorMessage(cancel.error) : undefined} />)}</div> : <EmptyState title={hasFilters ? t('No matching orders') : t('No orders yet')} message={hasFilters ? t('Try changing your search or filters.') : t('Your next favorite thing could be just around the corner.')} action={hasFilters ? <button className="button secondary" type="button" onClick={clearFilters}>{t('Clear filters')}</button> : <Link className="button primary" to="/products">{t('Start shopping')}</Link>} />}
    {query.data ? <Pagination page={query.data.meta?.current_page ?? page} pages={query.data.meta?.last_page ?? 1} onChange={(nextPage) => setParams({ ...Object.fromEntries(params.entries()), page: String(nextPage) })} /> : null}
  </div>
}

function OrderCancellationConfirmation({ orderNumber, pending, error, onConfirm, onCancel }: { orderNumber: string; pending: boolean; error?: string; onConfirm: () => void; onCancel: () => void }) {
  const { t } = useLanguage()
  return <div className="customer-action-confirmation" role="alertdialog" aria-labelledby={'cancel-order-' + orderNumber} aria-describedby={'cancel-order-explanation-' + orderNumber}><strong id={'cancel-order-' + orderNumber}>{t('Cancel this order?')}</strong><p id={'cancel-order-explanation-' + orderNumber}>{t('Once an order is confirmed, it cannot be cancelled through the normal customer workflow. This action only cancels an order that is still eligible under the current rules.')}</p>{error ? <p className="error" role="alert">{error}</p> : null}<div className="actions"><button className="button secondary" type="button" onClick={onCancel} disabled={pending}>{t('Keep order')}</button><button className="button danger" type="button" onClick={onConfirm} disabled={pending}>{pending ? t('Cancelling…') : t('Confirm cancellation')}</button></div></div>
}

function OrderCard({ order, onCancel, cancelling, confirming, onConfirm, onCancelConfirmation, cancellationError }: { order: Order; onCancel: () => void; cancelling: boolean; confirming: boolean; onConfirm: () => void; onCancelConfirmation: () => void; cancellationError?: string }) {
  const { t } = useLanguage()
  const item = order.items?.[0]
  const additionalItems = Math.max(0, (order.items?.length ?? 0) - 1)
  return <article className="customer-order-card">{item?.product_image ? <img className="order-thumb" src={item.product_image} alt={item.product_name} /> : <div className="order-thumb placeholder" aria-hidden="true">K</div>}<div className="customer-order-card-content"><div className="customer-order-card-heading"><div><span className="eyebrow">{order.order_number}</span><h2>{item?.product_name ?? t('Order items')}</h2></div><div className="customer-order-card-badges"><StatusBadge value={order.payment_status} /><StatusBadge value={order.fulfillment_status} /></div></div><div className="customer-order-card-meta"><span>{order.placed_at ? new Date(order.placed_at).toLocaleString() : t('Date unavailable')}</span><span>{item?.seller?.store_name ?? t('Kipi marketplace')}</span>{additionalItems ? <span>+{additionalItems} {t('more items')}</span> : null}</div></div><div className="customer-order-card-total"><strong>{order.grand_total_minor.toLocaleString()} {order.currency}</strong><Link className="text-link" to={'/account/orders/' + order.id}>{t('View details')} <ArrowRight size={15} /></Link>{canCancelOrder(order) ? <button className="text-button danger" type="button" onClick={onCancel} disabled={cancelling || confirming}>{cancelling ? t('Cancelling…') : t('Cancel order')}</button> : null}</div>{confirming && canCancelOrder(order) ? <OrderCancellationConfirmation orderNumber={order.order_number} pending={cancelling} error={cancellationError} onConfirm={onConfirm} onCancel={onCancelConfirmation} /> : null}</article>
}

export function OrderDetailPage() {
  const { t } = useLanguage()
  const { id = '' } = useParams()
  const navigate = useNavigate()
  const query = useQuery({ queryKey: ['order', id], queryFn: () => storefrontApi.order(id) })
  const queryClient = useQueryClient()
  const [showCancellationConfirmation, setShowCancellationConfirmation] = useState(false)
  const cancel = useMutation({ mutationFn: storefrontApi.cancelOrder, onSuccess: async () => { await Promise.allSettled([queryClient.invalidateQueries({ queryKey: ['order', id] }), queryClient.invalidateQueries({ queryKey: ['orders'] }), queryClient.invalidateQueries({ queryKey: ['cart'] })]); queryClient.removeQueries({ queryKey: ['checkout-preview'] }); setShowCancellationConfirmation(false); navigate('/products') }, onError: () => { queryClient.invalidateQueries({ queryKey: ['order', id] }); queryClient.invalidateQueries({ queryKey: ['orders'] }); queryClient.invalidateQueries({ queryKey: ['cart'] }) } })
  if (query.isLoading) return <LoadingState />
  if (query.isError || !query.data) return <ErrorState message={t('We could not find that order.')} />
  const order = query.data.data
  const payment = order.payments?.[0]
  const shipments = order.shipments ?? []
  const timeline = [...(order.status_history ?? []).map((event) => ({ id: 'order-' + event.id, label: event.to_status, date: event.created_at, note: event.note })), ...shipments.flatMap((shipment) => (shipment.tracking ?? []).map((event) => ({ id: 'tracking-' + event.id, label: event.status, date: event.occurred_at, note: event.message ?? event.location })))]
    .sort((left, right) => new Date(left.date).getTime() - new Date(right.date).getTime())
  return <div className="customer-order-detail-page"><Breadcrumbs items={[{ label: t('Account'), to: '/account' }, { label: t('My Orders'), to: '/account/orders' }, { label: order.order_number }]} /><header className="customer-order-detail-header"><div className="customer-order-detail-top"><Link className="text-link" to="/account/orders"><ArrowLeft size={15} />{t('Back to orders')}</Link><span className="customer-order-id">{order.order_number}</span></div><div className="customer-order-detail-title"><div><span className="eyebrow">{t('Order details')}</span><h1>{order.order_number}</h1><p>{order.placed_at ? `${t('Placed')} ${new Date(order.placed_at).toLocaleString()}` : t('Date unavailable')}</p></div><div className="customer-order-detail-status">{isCustomerConfirmed(order) ? <span className="status-badge status-confirmed">{t('Order confirmed')}</span> : null}<StatusBadge value={order.payment_status} /><StatusBadge value={order.fulfillment_status} /></div></div></header><div className="customer-order-detail-grid"><main className="customer-order-detail-main"><Card><div className="customer-card-heading"><div><span className="eyebrow">{t('Your purchase')}</span><h2>{t('Order items')}</h2></div><span className="muted">{order.items?.length ?? 0} {t('items')}</span></div><div className="customer-order-items">{order.items?.map((item) => <div className="customer-order-item" key={item.id}>{item.product_image ? <img src={item.product_image} alt={item.product_name} /> : <div className="customer-order-item-placeholder" aria-hidden="true">K</div>}<div className="customer-order-item-copy"><strong>{item.product_name}</strong><small>{item.sku}{item.attributes ? ` · ${Object.entries(item.attributes).map(([key, value]) => `${key}: ${value}`).join(' · ')}` : ''}</small><small>{t('Quantity')}: {item.quantity}{item.seller?.store_name ? ` · ${item.seller.store_name}` : ''}</small></div><PriceDisplay amount={item.line_total_minor ?? item.unit_price_minor * item.quantity} currency={order.currency} /></div>)}</div></Card><Card><div className="customer-card-heading"><div><span className="eyebrow">{t('Delivery')}</span><h2>{t('Shipping and tracking')}</h2></div><Truck size={19} /></div><div className="customer-detail-grid"><div><span>{t('Delivery method')}</span><strong>{order.shipping_method?.name ?? t('Shipping method unavailable')}</strong></div><div><span>{t('Fulfillment status')}</span><StatusBadge value={order.fulfillment_status} /></div></div>{shipments.length ? shipments.map((shipment) => { const trackingNumber = shipment.tracking_number ?? shipment.internal_tracking_id; const trackingUrl = shipment.metadata?.tracking_url; return <div className="customer-shipment-row" key={shipment.id}><div><strong>{shipment.carrier ?? t('Kipi delivery')}</strong><small>{trackingNumber ? `${t('Tracking number')}: ${trackingNumber}` : t('Tracking information is not available yet.')}</small></div><div>{trackingUrl ? <a className="button secondary" href={trackingUrl} target="_blank" rel="noreferrer">{t('Track package')}</a> : null}<Link className="text-link" to={'/account/orders/' + order.id + '/tracking'}>{t('View tracking')}</Link></div></div> }) : <p className="muted">{t('Tracking information is not available yet.')}</p>}</Card><Card><div className="customer-card-heading"><div><span className="eyebrow">{t('Order timeline')}</span><h2>{t('Status updates')}</h2></div><PackageCheck size={19} /></div>{timeline.length ? <div className="customer-order-timeline">{timeline.map((event) => <div className="customer-order-timeline-item" key={event.id}><span className="customer-order-timeline-dot" /><div><strong>{statusLabel(event.label, t)}</strong><small>{new Date(event.date).toLocaleString()}</small>{event.note ? <p>{event.note}</p> : null}</div></div>)}</div> : <p className="muted">{t('No order updates are available yet.')}</p>}</Card></main><aside className="customer-order-detail-side"><Card><div className="customer-card-heading"><div><span className="eyebrow">{t('Payment')}</span><h2>{t('Payment summary')}</h2></div><CreditCard size={19} /></div><div className="customer-payment-status"><span>{t('Payment status')}</span><StatusBadge value={order.payment_status} /></div><div className="customer-detail-grid"><div><span>{t('Payment method')}</span><strong>{payment?.provider ?? t('Payment method unavailable')}</strong></div><div><span>{t('Payment reference')}</span><strong>{payment?.provider_payment_id ?? t('Not available')}</strong></div></div>{payment && ['kbzpay', 'ayapay', 'wavepay', 'bank_transfer'].includes(payment.provider) ? <PaymentReceiptForm orderId={order.id} payment={payment} /> : null}</Card><Card><div className="customer-card-heading"><div><span className="eyebrow">{t('Total')}</span><h2>{t('Order summary')}</h2></div></div><SummaryRow label={t('Subtotal')} value={order.subtotal_minor} currency={order.currency} /><SummaryRow label={t('Discount')} value={order.discount_minor} currency={order.currency} /><SummaryRow label={t('Shipping')} value={order.shipping_minor} currency={order.currency} /><SummaryRow label={t('Tax')} value={order.tax_minor} currency={order.currency} /><div className="summary-total"><span>{t('Grand total')}</span><strong>{order.grand_total_minor.toLocaleString()} {order.currency}</strong></div></Card><Card><div className="customer-card-heading"><div><span className="eyebrow">{t('Order actions')}</span><h2>{t('Need help?')}</h2></div><ShieldCheck size={19} /></div>{canCancelOrder(order) ? <><button className="button secondary full" type="button" onClick={() => { cancel.reset(); setShowCancellationConfirmation(true) }} disabled={cancel.isPending}>{cancel.isPending ? t('Cancelling…') : t('Cancel order')}</button>{showCancellationConfirmation ? <OrderCancellationConfirmation orderNumber={order.order_number} pending={cancel.isPending} error={cancel.isError ? apiErrorMessage(cancel.error) : undefined} onConfirm={() => cancel.mutate(order.id)} onCancel={() => { cancel.reset(); setShowCancellationConfirmation(false) }} /> : null}</> : null}<Link className="button primary full" to="/contact">{t('Contact support')}</Link>{cancel.isError && !showCancellationConfirmation ? <p className="error" role="alert">{apiErrorMessage(cancel.error)}</p> : cancel.isSuccess ? <p className="success-box">{t('Order cancelled.')}</p> : null}</Card><Card><div className="customer-card-heading"><div><span className="eyebrow">{t('Delivery address')}</span><h2>{t('Where we are sending it')}</h2></div><MapPin size={19} /></div><p className="muted">{formatAddress(order.shipping_address)}</p></Card></aside></div></div>
}

function PaymentReceiptForm({ orderId, payment }: { orderId: number; payment: NonNullable<Order['payments']>[number] }) {
  const { t } = useLanguage()
  const client = useQueryClient()
  const [senderName, setSenderName] = useState('')
  const [senderPhone, setSenderPhone] = useState('')
  const [transactionCode, setTransactionCode] = useState('')
  const [file, setFile] = useState<File | null>(null)
  const [fileError, setFileError] = useState('')
  const [previewUrl, setPreviewUrl] = useState('')
  const [uploadProgress, setUploadProgress] = useState(0)
  const mutation = useMutation({ mutationFn: () => { const data = new FormData(); data.append('sender_name', senderName.trim()); if (senderPhone.trim()) data.append('sender_phone', senderPhone.trim()); if (transactionCode.trim()) data.append('transaction_code', transactionCode.trim()); if (file) data.append('receipt', file); return storefrontApi.submitPaymentReceipt(orderId, payment.id, data, (event) => { if (event.total) setUploadProgress(Math.round((event.loaded / event.total) * 100)) }) }, onSuccess: () => { client.invalidateQueries({ queryKey: ['order', String(orderId)] }); setFile(null); setFileError(''); setUploadProgress(0); setSenderName(''); setSenderPhone(''); setTransactionCode('') }, onError: () => setUploadProgress(0) })
  useEffect(() => { if (!file) { setPreviewUrl(''); return undefined } const url = URL.createObjectURL(file); setPreviewUrl(url); return () => URL.revokeObjectURL(url) }, [file])
  function selectReceipt(selected: File | null) {
    setFileError('')
    if (!selected) { setFile(null); return }
    const hasSupportedType = ['image/jpeg', 'image/png'].includes(selected.type) || /\.(jpe?g|png)$/i.test(selected.name)
    if (!hasSupportedType) { setFile(null); setFileError(t('Please choose a JPG or PNG image.')); return }
    if (selected.size > 5 * 1024 * 1024) { setFile(null); setFileError(t('Receipt image must be 5 MB or smaller.')); return }
    setFile(selected)
  }
  const receipt = payment.receipt
  if (payment.status === 'paid' || receipt?.status === 'approved') return <div className="payment-receipt-status submitted"><strong>{t('Payment verified')}</strong><p>{t('This payment was verified by an authorized administrator.')}</p></div>
  if (receipt?.status === 'submitted') return <div className="payment-receipt-status submitted"><strong>{t('Receipt pending verification')}</strong><p>{t('Your receipt was submitted. Payment remains pending until an authorized administrator verifies it.')}</p></div>
  return <div className="payment-receipt-form"><div className="payment-receipt-heading"><div><span className="eyebrow">{t('Payment receipt')}</span><h3>{t('Submit proof of transfer')}</h3></div><Upload size={18} /></div><p className="muted">{t('Upload a clear JPG or PNG receipt. Submission does not confirm payment.')}</p>{receipt?.status === 'rejected' ? <div className="payment-receipt-rejection" role="alert"><strong>{t('Receipt rejected')}</strong><span>{receipt.rejection_reason || t('Please submit a corrected receipt.')}</span></div> : null}<div className="receipt-form-grid"><label className="field"><span>{t('Sender name')}</span><input value={senderName} onChange={(event) => setSenderName(event.target.value)} required autoComplete="name" /></label><label className="field"><span>{t('Sender phone (optional)')}</span><input value={senderPhone} onChange={(event) => setSenderPhone(event.target.value)} inputMode="tel" autoComplete="tel" /></label><label className="field"><span>{t('Transaction/reference ID (optional)')}</span><input value={transactionCode} onChange={(event) => setTransactionCode(event.target.value)} /></label></div><label className="receipt-dropzone"><Upload size={20} /><span>{file ? t('Replace receipt image') : t('Choose receipt image')}</span><small>{file ? `${file.name} · ${formatReceiptFileSize(file.size)}` : t('JPG or PNG, up to 5 MB')}</small><input type="file" accept=".jpg,.jpeg,.png,image/jpeg,image/png" onChange={(event) => { selectReceipt(event.target.files?.[0] ?? null); event.currentTarget.value = '' }} /></label>{fileError ? <p className="error" role="alert">{fileError}</p> : null}{previewUrl ? <div className="receipt-preview"><img src={previewUrl} alt={t('Selected payment receipt preview')} /><button className="icon-button" type="button" onClick={() => { setFile(null); setFileError('') }} aria-label={t('Remove selected receipt')}><X size={15} /></button></div> : null}{mutation.isPending ? <progress className="receipt-upload-progress" value={uploadProgress} max="100" aria-label={t('Receipt upload progress')} /> : null}<button className="button primary full" type="button" onClick={() => mutation.mutate()} disabled={mutation.isPending || !senderName.trim() || !file}>{mutation.isPending ? `${t('Uploading receipt…')} ${uploadProgress || 0}%` : t('Submit payment for verification')}</button>{mutation.isError ? <p className="error" role="alert">{apiErrorMessage(mutation.error)}</p> : mutation.isSuccess ? <p className="success-box" role="status">{t('Receipt submitted for review.')}</p> : null}</div>
}

function formatReceiptFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
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
  const [copied, setCopied] = useState(false)
  async function copyTracking() { if (!trackingNumber) return; await navigator.clipboard.writeText(trackingNumber); setCopied(true); window.setTimeout(() => setCopied(false), 1800) }
  const trackingUrl = shipment.metadata?.tracking_url
  const trackingNumber = shipment.tracking_number ?? shipment.internal_tracking_id
  return <Card><div className="card-heading"><div><span className="eyebrow">Shipment #{shipment.id}</span><h2>{shipment.carrier ?? 'Kipi Self Delivery'}</h2><p className="muted">{shipment.delivery_method === 'self_delivery' ? 'Self delivery' : 'External courier'} · {shipment.method?.name ?? 'Shipping method unavailable'}{shipment.seller_order?.seller?.store_name ? ` · ${shipment.seller_order.seller.store_name}` : ''}</p></div><StatusBadge value={shipment.status} /></div>{trackingNumber ? <div className="tracking-summary"><div><span className="muted">{shipment.internal_tracking_id ? 'Internal tracking ID' : 'Tracking number'}</span><strong>{trackingNumber}</strong></div><button className="button secondary" type="button" onClick={copyTracking}><Copy size={15} />{copied ? 'Copied' : 'Copy'}</button>{trackingUrl ? <a className="button primary" href={trackingUrl} target="_blank" rel="noreferrer">Track package</a> : null}</div> : <p className="muted">Tracking number has not been added yet.</p>}{shipment.rider ? <p className="muted">Assigned rider: {shipment.rider.name}</p> : null}{shipment.shipped_at ? <p className="muted">Shipped {new Date(shipment.shipped_at).toLocaleString()}</p> : null}{shipment.estimated_delivery_at ? <p className="muted">Estimated delivery: {new Date(shipment.estimated_delivery_at).toLocaleDateString()}</p> : null}{shipment.delivered_at ? <p className="muted">Delivered {new Date(shipment.delivered_at).toLocaleString()}</p> : null}{tracking.isLoading ? <LoadingState /> : tracking.data?.data.length ? <div className="timeline">{tracking.data.data.map((event: TrackingEvent) => <div className="timeline-item" key={event.id}><span className="timeline-dot" /><div><strong>{event.status.replaceAll('_', ' ')}</strong><small>{new Date(event.occurred_at).toLocaleString()}</small><p>{event.message ?? event.location ?? 'Shipment update received.'}</p></div></div>)}</div> : <p className="muted">No tracking events have been recorded yet.</p>}</Card>
}

function SummaryRow({ label, value, currency }: { label: string; value: number; currency: string }) { return <div className="summary-row"><span>{label}</span><span>{value.toLocaleString()} {currency}</span></div> }
function formatAddress(address?: Record<string, unknown>) { return address ? Object.values(address).filter(Boolean).join(', ') : 'Address unavailable.' }
