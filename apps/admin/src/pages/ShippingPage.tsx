import { useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Card, ErrorState, LoadingState, PageHeader, StatusBadge } from '../components/ui'
import { adminApi } from '../services/adminApi'
import type { ShippingMethod } from '../types/admin'

type Feedback = { kind: 'success' | 'error'; message: string }

function apiErrorMessage(error: unknown, fallback = 'The shipping carrier could not be saved. Please review the details and try again.'): string {
  const candidate = error as {
    message?: unknown
    response?: { data?: { message?: unknown; errors?: Record<string, unknown> } }
  }
  const responseData = candidate.response?.data
  if (typeof responseData?.message === 'string') return responseData.message

  const validationMessage = Object.values(responseData?.errors ?? {})
    .flatMap((value) => Array.isArray(value) ? value : [value])
    .find((value): value is string => typeof value === 'string')
  if (validationMessage) return validationMessage
  if (typeof candidate.message === 'string') return candidate.message
  return fallback
}

export function ShippingPage() {
  const client = useQueryClient()
  const [carrierName, setCarrierName] = useState('')
  const [carrierCode, setCarrierCode] = useState('')
  const [carrierUrl, setCarrierUrl] = useState('')
  const [carrierFeedback, setCarrierFeedback] = useState<Feedback | null>(null)
  const [methodName, setMethodName] = useState('')
  const [methodCode, setMethodCode] = useState('')
  const [methodDescription, setMethodDescription] = useState('')
  const [methodPrice, setMethodPrice] = useState('0')
  const [methodSortOrder, setMethodSortOrder] = useState('0')
  const [editingMethod, setEditingMethod] = useState<ShippingMethod | null>(null)
  const [methodFeedback, setMethodFeedback] = useState<Feedback | null>(null)
  const [riderName, setRiderName] = useState('')
  const [riderPhone, setRiderPhone] = useState('')
  const [riderUserId, setRiderUserId] = useState('')
  const [riderFeedback, setRiderFeedback] = useState<Feedback | null>(null)

  const carriers = useQuery({
    queryKey: ['shipping-carriers'],
    queryFn: () => adminApi.carriers({ per_page: '100' }),
  })
  const shippingMethods = useQuery({
    queryKey: ['shipping-methods'],
    queryFn: () => adminApi.shippingMethods({ per_page: '100' }),
  })
  const riders = useQuery({
    queryKey: ['shipping-riders'],
    queryFn: () => adminApi.riders({ per_page: '100' }),
  })

  const resetMethodForm = () => {
    setMethodName('')
    setMethodCode('')
    setMethodDescription('')
    setMethodPrice('0')
    setMethodSortOrder('0')
    setEditingMethod(null)
  }

  const methodPayload = () => ({
    name: methodName.trim(),
    code: methodCode.trim(),
    description: methodDescription.trim() || undefined,
    price_minor: Number(methodPrice),
    currency: 'MMK',
    sort_order: Number(methodSortOrder),
    is_active: true,
  })

  const saveShippingMethod = useMutation({
    mutationFn: () => editingMethod ? adminApi.updateShippingMethod(editingMethod.id, methodPayload()) : adminApi.createShippingMethod(methodPayload()),
    onMutate: () => setMethodFeedback(null),
    onSuccess: async (saved) => {
      try {
        await client.invalidateQueries({ queryKey: ['shipping-methods'] })
        resetMethodForm()
        setMethodFeedback({ kind: 'success', message: `${saved.name} was ${editingMethod ? 'updated' : 'added'} successfully.` })
      } catch (error) {
        setMethodFeedback({ kind: 'error', message: `The delivery option was saved, but the list could not be refreshed. ${apiErrorMessage(error)}` })
      }
    },
    onError: (error) => setMethodFeedback({ kind: 'error', message: apiErrorMessage(error) }),
  })

  const toggleShippingMethod = useMutation({
    mutationFn: (item: ShippingMethod) => adminApi.updateShippingMethod(item.id, { is_active: !item.is_active }),
    onMutate: () => setMethodFeedback(null),
    onSuccess: () => client.invalidateQueries({ queryKey: ['shipping-methods'] }),
    onError: (error) => setMethodFeedback({ kind: 'error', message: apiErrorMessage(error) }),
  })

  const createCarrier = useMutation({
    mutationFn: () => adminApi.createCarrier({
      name: carrierName.trim(),
      code: carrierCode.trim() || undefined,
      type: 'external_courier',
      tracking_url: carrierUrl.trim() || undefined,
    }),
    onMutate: () => setCarrierFeedback(null),
    onSuccess: async (created) => {
      try {
        // Refetch instead of appending locally so each persisted carrier appears once.
        await client.invalidateQueries({ queryKey: ['shipping-carriers'] })
        setCarrierName('')
        setCarrierCode('')
        setCarrierUrl('')
        setCarrierFeedback({ kind: 'success', message: `${created.name} was added successfully.` })
      } catch (error) {
        setCarrierFeedback({ kind: 'error', message: `The carrier was saved, but the list could not be refreshed. ${apiErrorMessage(error)}` })
      }
    },
    onError: (error) => setCarrierFeedback({ kind: 'error', message: apiErrorMessage(error) }),
  })

  const toggleCarrier = useMutation({
    mutationFn: (item: { id: number; is_active: boolean }) => adminApi.updateCarrier(item.id, { is_active: !item.is_active }),
    onMutate: () => setCarrierFeedback(null),
    onSuccess: () => client.invalidateQueries({ queryKey: ['shipping-carriers'] }),
    onError: (error) => setCarrierFeedback({ kind: 'error', message: apiErrorMessage(error) }),
  })

  const createRider = useMutation({
    mutationFn: () => adminApi.createRider({
      user_id: riderUserId ? Number(riderUserId) : undefined,
      name: riderName.trim(),
      phone: riderPhone.trim() || undefined,
      status: 'active',
    }),
    onSuccess: () => {
      setRiderName('')
      setRiderPhone('')
      setRiderUserId('')
      setRiderFeedback(null)
      client.invalidateQueries({ queryKey: ['shipping-riders'] })
    },
    onError: (error) => setRiderFeedback({ kind: 'error', message: apiErrorMessage(error, 'The rider could not be saved. Please review the details and try again.') }),
  })

  const toggleRider = useMutation({
    mutationFn: (item: { id: number; status: string }) => adminApi.updateRider(item.id, { status: item.status === 'active' ? 'inactive' : 'active' }),
    onMutate: () => setRiderFeedback(null),
    onSuccess: async () => {
      try {
        await client.invalidateQueries({ queryKey: ['shipping-riders'] })
      } catch (error) {
        setRiderFeedback({ kind: 'error', message: `The rider status was saved, but the list could not be refreshed. ${apiErrorMessage(error, 'Refresh the page to see the latest status.')}` })
      }
    },
    onError: (error) => setRiderFeedback({ kind: 'error', message: apiErrorMessage(error, 'The rider status could not be updated. Please try again.') }),
  })

  if (carriers.isLoading || shippingMethods.isLoading || riders.isLoading) return <LoadingState />
  if (carriers.isError || shippingMethods.isError || riders.isError || !carriers.data || !shippingMethods.data || !riders.data) return <ErrorState message="Unable to load shipping configuration." />

  return <div className="page-stack">
    <PageHeader eyebrow="Operations" title="Shipping" description="Configure external couriers and authorized self-delivery riders. Existing shipments are preserved when a provider is disabled." />

    <div className="detail-grid">
      <Card>
        <div className="card-heading"><div><h2>Select delivery options</h2><p>These options appear in customer checkout.</p></div></div>
        <form className="inline-form" onSubmit={(event) => { event.preventDefault(); saveShippingMethod.mutate() }}>
          <input required placeholder="Delivery name" value={methodName} onChange={(event) => setMethodName(event.target.value)} />
          <input required placeholder="Code" value={methodCode} onChange={(event) => setMethodCode(event.target.value)} />
          <input type="number" min="0" step="1" required placeholder="Fee (MMK)" value={methodPrice} onChange={(event) => setMethodPrice(event.target.value)} />
          <input placeholder="Description / delivery estimate" value={methodDescription} onChange={(event) => setMethodDescription(event.target.value)} />
          <input type="number" min="0" step="1" placeholder="Display order" value={methodSortOrder} onChange={(event) => setMethodSortOrder(event.target.value)} />
          <button className="button primary" type="submit" disabled={saveShippingMethod.isPending}>{saveShippingMethod.isPending ? 'Saving…' : editingMethod ? 'Save changes' : 'Add delivery'}</button>
          {editingMethod ? <button className="button secondary" type="button" onClick={resetMethodForm} disabled={saveShippingMethod.isPending}>Cancel</button> : null}
        </form>
        {methodFeedback ? <p className={methodFeedback.kind === 'error' ? 'error-box shipping-feedback' : 'success-box shipping-feedback'} role="status">{methodFeedback.message}</p> : null}
        <div className="table-wrap">
          <table className="shipping-table" aria-label="Delivery methods">
            <thead><tr><th>Delivery option</th><th>Code</th><th>Fee</th><th>Status</th><th>Actions</th></tr></thead>
            <tbody>
              {shippingMethods.data.data.map((item) => <tr key={item.id}>
                <td><strong>{item.name}</strong><small>{item.description ?? 'No description'}</small></td>
                <td>{item.code}</td>
                <td>{item.price_minor.toLocaleString()} {item.currency}</td>
                <td><StatusBadge value={item.is_active} /></td>
                <td className="actions-cell"><button className="text-button" type="button" onClick={() => { setEditingMethod(item); setMethodName(item.name); setMethodCode(item.code); setMethodDescription(item.description ?? ''); setMethodPrice(String(item.price_minor)); setMethodSortOrder(String(item.sort_order)); setMethodFeedback(null) }}>Edit</button><button className="text-button" type="button" onClick={() => toggleShippingMethod.mutate(item)} disabled={toggleShippingMethod.isPending}>{item.is_active ? 'Disable' : 'Activate'}</button></td>
              </tr>)}
              {!shippingMethods.data.data.length ? <tr><td colSpan={5}><p className="muted">No delivery options configured. Add the first option above.</p></td></tr> : null}
            </tbody>
          </table>
        </div>
      </Card>

      <Card>
        <h2>External carriers</h2>
        <form className="inline-form" onSubmit={(event) => { event.preventDefault(); createCarrier.mutate() }}>
          <input required placeholder="Carrier name" value={carrierName} onChange={(event) => setCarrierName(event.target.value)} />
          <input placeholder="Code" value={carrierCode} onChange={(event) => setCarrierCode(event.target.value)} />
          <input type="url" placeholder="Tracking website (optional)" value={carrierUrl} onChange={(event) => setCarrierUrl(event.target.value)} />
          <button className="button primary" type="submit" disabled={createCarrier.isPending}>{createCarrier.isPending ? 'Saving…' : 'Add carrier'}</button>
        </form>
        {carrierFeedback ? <p className={carrierFeedback.kind === 'error' ? 'error-box shipping-feedback' : 'success-box shipping-feedback'} role="status">{carrierFeedback.message}</p> : null}

        <div className="table-wrap">
          <table className="shipping-table" aria-label="Shipping carriers">
            <thead><tr><th>Carrier</th><th>Code</th><th>Type</th><th>Tracking website</th><th>Status</th><th>Actions</th></tr></thead>
            <tbody>
              {carriers.data.data.map((item) => <tr key={item.id}>
                <td><strong>{item.name}</strong><small>Record #{item.id}</small></td>
                <td>{item.code}</td>
                <td>{item.type.replaceAll('_', ' ')}</td>
                <td>{item.tracking_url ? <a href={item.tracking_url} target="_blank" rel="noreferrer">Open tracking site</a> : <span className="muted">Not configured</span>}</td>
                <td><StatusBadge value={item.is_active} /></td>
                <td><button className="text-button" type="button" onClick={() => toggleCarrier.mutate(item)} disabled={toggleCarrier.isPending}>{item.is_active ? 'Disable' : 'Activate'}</button></td>
              </tr>)}
              {!carriers.data.data.length ? <tr><td colSpan={6}><p className="muted">No carriers configured. Add the first shipping carrier above.</p></td></tr> : null}
            </tbody>
          </table>
        </div>
      </Card>

      <Card>
        <h2>Self-delivery riders</h2>
        <form className="inline-form" onSubmit={(event) => { event.preventDefault(); createRider.mutate() }}>
          <input required placeholder="Rider name" value={riderName} onChange={(event) => setRiderName(event.target.value)} />
          <input placeholder="Phone" value={riderPhone} onChange={(event) => setRiderPhone(event.target.value)} />
          <input type="number" min="1" placeholder="Existing user ID (optional)" value={riderUserId} onChange={(event) => setRiderUserId(event.target.value)} />
          <button className="button primary" type="submit" disabled={createRider.isPending}>{createRider.isPending ? 'Saving…' : 'Add rider'}</button>
        </form>
        {riderFeedback ? <p className={riderFeedback.kind === 'error' ? 'error-box shipping-feedback' : 'success-box shipping-feedback'} role="status">{riderFeedback.message}</p> : null}
        <div className="rider-list">
          {riders.data.data.map((item) => <div className="rider-row" key={item.id}>
            <div className="rider-summary"><strong>{item.name}</strong><small>{item.phone ?? 'No phone'} · {item.seller?.store_name ?? 'Kipi-managed'}</small></div>
            <div className="rider-actions"><StatusBadge value={item.status === 'active' ? 'active' : 'disabled'} /><button className="button secondary rider-status-action" type="button" onClick={() => toggleRider.mutate(item)} disabled={toggleRider.isPending}>{item.status === 'active' ? 'Disable' : 'Enable'}</button></div>
          </div>)}
        </div>
        {!riders.data.data.length ? <p className="muted">No riders configured.</p> : null}
      </Card>
    </div>
  </div>
}
