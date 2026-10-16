import { useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Check, CircleDollarSign, X } from 'lucide-react'
import { ApiClientError } from '@kipi/api-client'
import { api } from '../lib/api'
import { Card, EmptyState, ErrorState, LoadingState, StatusBadge } from '../components/ui'

type PayoutMethod = {
  id: number
  method: string
  provider_name: string | null
  account_holder_name: string
  masked_identifier: string
  verification_status: string
}

type Payout = {
  id: number
  seller_id: number
  seller?: { id: number; store_name: string } | null
  payout_method?: PayoutMethod | null
  status: string
  amount_minor: number
  currency: string
  provider: string | null
  provider_payout_id: string | null
  failure_message: string | null
  requested_at: string | null
}

type PayoutResponse = { data: Payout[]; meta?: { current_page?: number; last_page?: number; total?: number } }

const money = (value: number, currency = 'MMK') => new Intl.NumberFormat('en-US', { style: 'currency', currency, maximumFractionDigits: 0 }).format(value)

function errorMessage(error: unknown) {
  if (error instanceof ApiClientError) {
    const details = Object.values(error.errors ?? {}).flat().join(' ')
    return details ? `${error.message}: ${details}` : error.message
  }
  return error instanceof Error ? error.message : 'The payout request failed.'
}

export function PayoutsPage() {
  const client = useQueryClient()
  const [page, setPage] = useState(1)
  const [feedback, setFeedback] = useState('')
  const payouts = useQuery({
    queryKey: ['admin-marketplace-payouts', page],
    queryFn: async () => (await api.request<PayoutResponse>({ url: '/admin/marketplace/payouts', params: { page, per_page: 30 } })).data,
  })
  const status = useMutation({
    mutationFn: async ({ payout, nextStatus }: { payout: Payout; nextStatus: string }) => {
      setFeedback('')
      const note = nextStatus === 'rejected' || nextStatus === 'cancelled' ? window.prompt('Reason (required for audit history)', payout.failure_message ?? '') : undefined
      if ((nextStatus === 'rejected' || nextStatus === 'cancelled') && !note?.trim()) throw new Error('A reason is required.')
      const providerReference = nextStatus === 'paid' ? window.prompt('Confirmed payment reference') : undefined
      if (nextStatus === 'paid' && !providerReference?.trim()) throw new Error('A confirmed payment reference is required.')
      return api.request({ url: `/admin/marketplace/payouts/${payout.id}/status`, method: 'PATCH', data: { status: nextStatus, note, provider_reference: providerReference } })
    },
    onSuccess: async () => { setFeedback('Payout status updated.'); await client.invalidateQueries({ queryKey: ['admin-marketplace-payouts'] }) },
    onError: (error) => setFeedback(errorMessage(error)),
  })
  const verify = useMutation({
    mutationFn: ({ method, verificationStatus }: { method: PayoutMethod; verificationStatus: string }) => api.request({ url: `/admin/marketplace/payout-methods/${method.id}/verification`, method: 'PATCH', data: { verification_status: verificationStatus } }),
    onSuccess: async () => { setFeedback('Payout method verification updated.'); await client.invalidateQueries({ queryKey: ['admin-marketplace-payouts'] }) },
    onError: (error) => setFeedback(errorMessage(error)),
  })

  if (payouts.isLoading) return <LoadingState />
  if (payouts.isError || !payouts.data) return <ErrorState message={errorMessage(payouts.error)} />
  const rows = payouts.data.data ?? []
  const lastPage = payouts.data.meta?.last_page ?? 1

  return <div className="page-stack">
    {feedback ? <div className={feedback.includes('updated') ? 'success-box' : 'error-box'} role="status">{feedback}</div> : null}
    <Card><div className="card-heading"><div><h2>Seller payouts</h2><p>Review seller requests and record only confirmed payment actions.</p></div><div className="stat-icon blue"><CircleDollarSign size={20} /></div></div>{rows.length ? <div className="table-wrap"><table><thead><tr><th>Seller</th><th>Amount</th><th>Method</th><th>Status</th><th>Requested</th><th>Reference</th><th>Actions</th></tr></thead><tbody>{rows.map((payout) => <tr key={payout.id}><td><strong>{payout.seller?.store_name ?? `Seller #${payout.seller_id}`}</strong><small>#{payout.id}</small></td><td>{money(payout.amount_minor, payout.currency)}</td><td>{payout.payout_method ? <><strong>{payout.payout_method.provider_name || payout.payout_method.method}</strong><small>{payout.payout_method.masked_identifier} · {payout.payout_method.verification_status}</small>{payout.payout_method.verification_status !== 'verified' ? <button className="text-button" type="button" disabled={verify.isPending} onClick={() => verify.mutate({ method: payout.payout_method!, verificationStatus: 'verified' })}>Verify method</button> : null}</> : payout.provider ?? 'Not configured'}</td><td><StatusBadge value={payout.status} />{payout.failure_message ? <small>{payout.failure_message}</small> : null}</td><td>{payout.requested_at ? new Date(payout.requested_at).toLocaleString() : '—'}</td><td>{payout.provider_payout_id ?? 'Not recorded'}</td><td><div className="button-row"><button className="icon-button" type="button" title="Approve" disabled={status.isPending || payout.status !== 'pending'} onClick={() => status.mutate({ payout, nextStatus: 'approved' })}><Check size={16} /></button><button className="icon-button danger" type="button" title="Reject" disabled={status.isPending || !['pending', 'approved', 'processing'].includes(payout.status)} onClick={() => status.mutate({ payout, nextStatus: 'rejected' })}><X size={16} /></button>{payout.status === 'approved' ? <button className="button small secondary" type="button" disabled={status.isPending} onClick={() => status.mutate({ payout, nextStatus: 'processing' })}>Process</button> : null}{payout.status === 'processing' ? <button className="button small primary" type="button" disabled={status.isPending} onClick={() => status.mutate({ payout, nextStatus: 'paid' })}>Mark paid</button> : null}</div></td></tr>)}</tbody></table></div> : <EmptyState title="No payout requests" message="Seller payout requests will appear here after a seller submits one." />}<div className="pagination"><button type="button" disabled={page <= 1} onClick={() => setPage((value) => value - 1)}>Previous</button><span>Page {page} of {lastPage}</span><button type="button" disabled={page >= lastPage} onClick={() => setPage((value) => value + 1)}>Next</button></div></Card>
  </div>
}
