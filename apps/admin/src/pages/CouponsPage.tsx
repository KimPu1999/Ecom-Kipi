import { useState } from 'react'
import { keepPreviousData, useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Edit3, Plus, Tag, Trash2 } from 'lucide-react'
import { adminApi } from '../services/adminApi'
import type { Coupon } from '../types/admin'
import { Card, ConfirmButton, EmptyState, ErrorState, LoadingState, PageHeader, SearchBox, StatusBadge } from '../components/ui'

const blank: Coupon = { id: 0, code: '', type: 'percentage', value: 1000, minimum_subtotal_minor: 0, maximum_discount_minor: null, usage_limit: null, usage_count: 0, per_user_limit: 1, starts_at: null, ends_at: null, is_active: true }

export function CouponsPage() {
  const client = useQueryClient()
  const [search, setSearch] = useState('')
  const [editing, setEditing] = useState<Coupon | null>(null)
  const query = useQuery({ queryKey: ['admin-coupons', search], queryFn: () => adminApi.coupons({ q: search }), placeholderData: keepPreviousData })
  const save = useMutation({ mutationFn: (coupon: Coupon) => coupon.id ? adminApi.updateCoupon(coupon.id, payload(coupon)) : adminApi.createCoupon(payload(coupon)), onSuccess: () => { setEditing(null); client.invalidateQueries({ queryKey: ['admin-coupons'] }) } })
  const disable = useMutation({ mutationFn: adminApi.disableCoupon, onSuccess: () => client.invalidateQueries({ queryKey: ['admin-coupons'] }) })
  if (query.isLoading) return <LoadingState />
  if (query.isError || !query.data) return <ErrorState message="Coupons could not be loaded." />
  return <div className="page-stack"><PageHeader eyebrow="Catalog" title="Coupons & promotions" description="Create controlled discounts that are recalculated server-side during checkout." action={<button className="button primary" onClick={() => setEditing({ ...blank })}><Plus size={17} /> New coupon</button>} />{editing ? <Card><div className="card-heading"><h2>{editing.id ? 'Edit coupon' : 'New coupon'}</h2></div><CouponForm value={editing} onChange={setEditing} onCancel={() => setEditing(null)} onSubmit={() => save.mutate(editing)} /></Card> : null}<Card><div className="toolbar"><SearchBox value={search} onChange={setSearch} placeholder="Search coupon code" /></div>{query.data.data.length ? <div className="table-wrap"><table><thead><tr><th>Code</th><th>Discount</th><th>Usage</th><th>Status</th><th /></tr></thead><tbody>{query.data.data.map((coupon) => <tr key={coupon.id}><td><strong>{coupon.code}</strong><small>{coupon.minimum_subtotal_minor.toLocaleString()} MMK minimum</small></td><td>{coupon.type === 'percentage' ? `${coupon.value / 100}%` : `${coupon.value.toLocaleString()} MMK`}</td><td>{coupon.usage_count}{coupon.usage_limit ? ` / ${coupon.usage_limit}` : ''}</td><td><StatusBadge value={coupon.is_active} /></td><td className="actions-cell"><button className="icon-button" onClick={() => setEditing(coupon)} aria-label="Edit coupon"><Edit3 size={16} /></button>{coupon.is_active ? <ConfirmButton onConfirm={() => disable.mutate(coupon.id)}><Trash2 size={16} /></ConfirmButton> : null}</td></tr>)}</tbody></table></div> : <EmptyState title="No coupons found" message="Create a promotion code to activate your first campaign." />}</Card></div>
}

function payload(coupon: Coupon) { return { code: coupon.code, type: coupon.type, value: coupon.value, minimum_subtotal_minor: coupon.minimum_subtotal_minor, maximum_discount_minor: coupon.maximum_discount_minor, usage_limit: coupon.usage_limit, per_user_limit: coupon.per_user_limit, starts_at: coupon.starts_at || null, ends_at: coupon.ends_at || null, is_active: coupon.is_active } }

function CouponForm({ value, onChange, onCancel, onSubmit }: { value: Coupon; onChange: (value: Coupon) => void; onCancel: () => void; onSubmit: () => void }) {
  const update = (field: keyof Coupon, next: string | number | boolean | null) => onChange({ ...value, [field]: next })
  return <form className="stack-form" onSubmit={(event) => { event.preventDefault(); onSubmit() }}><div className="form-grid"><label>Code<input required value={value.code} onChange={(event) => update('code', event.target.value.toUpperCase())} placeholder="WELCOME10" /></label><label>Type<select value={value.type} onChange={(event) => update('type', event.target.value)}><option value="percentage">Percentage (basis points)</option><option value="fixed">Fixed amount</option></select></label><label>Value<input required type="number" min="1" value={value.value} onChange={(event) => update('value', Number(event.target.value))} /></label><label>Minimum subtotal<input type="number" min="0" value={value.minimum_subtotal_minor} onChange={(event) => update('minimum_subtotal_minor', Number(event.target.value))} /></label><label>Maximum discount<input type="number" min="1" value={value.maximum_discount_minor ?? ''} onChange={(event) => update('maximum_discount_minor', event.target.value ? Number(event.target.value) : null)} /></label><label>Usage limit<input type="number" min="1" value={value.usage_limit ?? ''} onChange={(event) => update('usage_limit', event.target.value ? Number(event.target.value) : null)} /></label></div><p className="muted">For percentage coupons, enter basis points: 1000 = 10%.</p><div className="form-actions"><button className="button secondary" type="button" onClick={onCancel}>Cancel</button><button className="button primary" type="submit"><Tag size={15} /> Save coupon</button></div></form>
}
