import { useState } from 'react'
import { ApiClientError } from '@kipi/api-client'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { AlertCircle, Check, FileText, LoaderCircle, X } from 'lucide-react'
import { api } from '../lib/api'

type Application = {
  id: number
  business_name: string
  business_type: string | null
  business_details?: Record<string, unknown> | null
  contact_details?: Record<string, unknown> | null
  application_status: string
  rejection_reason?: string | null
  submitted_at?: string | null
  reviewed_at?: string | null
  documents?: { id: number; document_type: string; status: string }[]
  user?: { name: string; email: string }
  approval_history?: { id: number; action: string; from_status: string | null; to_status: string; reason: string | null; created_at: string }[]
}

type Page<T> = { data: T[]; meta?: { total: number } }
type SellerRow = { id: number; store_name: string; slug: string; status: string; products_count?: number; orders_count?: number }

function apiErrorMessage(error: unknown): string {
  if (error instanceof ApiClientError) {
    const details = Object.values(error.errors ?? {}).flat().join(' ')
    return details ? `${error.message}: ${details}` : error.message
  }

  return error instanceof Error ? error.message : 'The marketplace request failed.'
}

function Feedback({ message, retry }: { message: string; retry?: () => void }) {
  return <div className="error-box feedback-box"><AlertCircle size={18} /><span>{message}</span>{retry ? <button className="text-button" onClick={retry}>Try again</button> : null}</div>
}

export function MarketplacePage() {
  const client = useQueryClient()
  const [actionError, setActionError] = useState('')
  const applications = useQuery({
    queryKey: ['marketplace-applications'],
    queryFn: async () => (await api.request<{ data: Page<Application> }>({ url: '/admin/marketplace/applications' })).data.data,
  })
  const review = useMutation({
    mutationFn: async ({ application, action }: { application: Application; action: 'approve' | 'reject' }) => {
      setActionError('')
      if (action === 'approve') {
        const storeName = window.prompt('Store name', application.business_name)
        if (!storeName?.trim()) throw new Error('Approval cancelled.')
        const slug = window.prompt('Store slug', storeName.toLowerCase().trim().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, ''))
        if (!slug?.trim()) throw new Error('Approval cancelled.')
        return api.request({ url: `/admin/marketplace/applications/${application.id}/approve`, method: 'POST', data: { store_name: storeName.trim(), slug: slug.trim() } })
      }
      const reason = window.prompt('Rejection reason', 'Please provide more business details.')
      if (!reason?.trim()) throw new Error('Rejection cancelled.')
      return api.request({ url: `/admin/marketplace/applications/${application.id}/reject`, method: 'POST', data: { rejection_reason: reason.trim() } })
    },
    onSuccess: async () => {
      await Promise.all([
        client.invalidateQueries({ queryKey: ['marketplace-applications'] }),
        client.invalidateQueries({ queryKey: ['marketplace-sellers'] }),
      ])
    },
    onError: (error) => setActionError(apiErrorMessage(error)),
  })

  if (applications.isLoading) return <div className="feedback"><LoaderCircle className="spin" size={18} /> Loading seller applications…</div>
  if (applications.isError) return <Feedback message={apiErrorMessage(applications.error)} retry={() => applications.refetch()} />

  const rows = applications.data?.data ?? []

  return <div className="page-stack">
    <div className="marketplace-connection-note"><span className="connection-dot" /><div><strong>Connected to seller applications</strong><p>New applications from <code>/account/seller-application</code> appear here after submission.</p></div></div>
    {actionError ? <Feedback message={actionError} /> : null}
    <div className="panel table-panel"><table><thead><tr><th>Business</th><th>Applicant</th><th>Details</th><th>Status</th><th>Review</th></tr></thead><tbody>{rows.map((application) => <tr key={application.id}><td><strong>{application.business_name}</strong><small>{application.business_type ?? 'Business type not provided'}</small></td><td>{application.user?.name ?? 'Unknown applicant'}<small>{application.user?.email ?? 'No email'}</small></td><td><small>{application.documents?.length ?? 0} verification document(s)</small><small>{application.approval_history?.length ?? 0} status event(s)</small></td><td><span className={'status status-' + application.application_status}>{application.application_status}</span>{application.rejection_reason ? <small>{application.rejection_reason}</small> : null}</td><td>{['pending', 'submitted', 'under_review'].includes(application.application_status) ? <span className="row-actions"><button className="icon-button" title="Approve application" onClick={() => review.mutate({ application, action: 'approve' })} disabled={review.isPending}><Check size={17} /></button><button className="icon-button danger" title="Reject application" onClick={() => review.mutate({ application, action: 'reject' })} disabled={review.isPending}><X size={17} /></button></span> : <span title="Approval history is available from the API"><FileText size={17} /></span>}</td></tr>)}</tbody></table>{!rows.length && <div className="empty-state"><h3>No seller applications yet</h3><p>Ask a customer to submit an application from their account page.</p></div>}</div>
  </div>
}

export function SellersPage() {
  const client = useQueryClient()
  const sellers = useQuery({ queryKey: ['marketplace-sellers'], queryFn: async () => (await api.request<{ data: Page<SellerRow> }>({ url: '/admin/marketplace/sellers' })).data.data })
  const status = useMutation({
    mutationFn: ({ id, value, reason }: { id: number; value: string; reason?: string }) => api.request({ url: `/admin/marketplace/sellers/${id}/status`, method: 'PATCH', data: { status: value, reason } }),
    onSuccess: () => client.invalidateQueries({ queryKey: ['marketplace-sellers'] }),
  })

  function changeStatus(id: number, value: string) {
    const reason: string | undefined = value === 'suspended' ? window.prompt('Suspension reason', 'Verification requires attention.') ?? undefined : undefined
    if (value === 'suspended' && !reason) return
    status.mutate({ id, value, reason })
  }

  if (sellers.isLoading) return <div className="feedback"><LoaderCircle className="spin" size={18} /> Loading seller accounts…</div>
  if (sellers.isError) return <Feedback message={apiErrorMessage(sellers.error)} retry={() => sellers.refetch()} />

  const rows = sellers.data?.data ?? []
  return <div className="page-stack">{status.error ? <Feedback message={apiErrorMessage(status.error)} /> : null}<div className="panel table-panel"><table><thead><tr><th>Store</th><th>Slug</th><th>Products</th><th>Orders</th><th>Status</th></tr></thead><tbody>{rows.map((seller) => <tr key={seller.id}><td><strong>{seller.store_name}</strong></td><td>{seller.slug}</td><td>{seller.products_count ?? 0}</td><td>{seller.orders_count ?? 0}</td><td><select value={seller.status} onChange={(event) => changeStatus(seller.id, event.target.value)} disabled={status.isPending}><option value="approved">Approved</option><option value="active">Approved (legacy)</option><option value="suspended">Suspended</option></select></td></tr>)}</tbody></table>{!rows.length && <div className="empty-state"><h3>No approved sellers yet</h3><p>Approve a pending application to create the seller account.</p></div>}</div></div>
}
