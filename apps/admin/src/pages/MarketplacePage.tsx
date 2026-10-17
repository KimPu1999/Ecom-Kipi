import { useEffect, useState } from 'react'
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
type ReviewAction = 'approve' | 'reject'

function fieldLabel(value: string): string {
  return value.replaceAll('_', ' ').replace(/\b\w/g, (letter) => letter.toUpperCase())
}

function fieldValue(value: unknown): string {
  if (value === null || value === undefined || value === '') return 'Not provided'
  if (typeof value === 'string' || typeof value === 'number' || typeof value === 'boolean') return String(value)
  return JSON.stringify(value)
}

function defaultStoreSlug(name: string, id: number): string {
  const slug = name.toLowerCase().trim().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '')
  return slug || `seller-${id}`
}

function DetailRecord({ label, value }: { label: string; value: unknown }) {
  return <div className="marketplace-detail-record"><dt>{label}</dt><dd>{fieldValue(value)}</dd></div>
}

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
  const [actionSuccess, setActionSuccess] = useState('')
  const [selectedApplicationId, setSelectedApplicationId] = useState<number | null>(null)
  const [pendingAction, setPendingAction] = useState<ReviewAction | null>(null)
  const [storeName, setStoreName] = useState('')
  const [storeSlug, setStoreSlug] = useState('')
  const [rejectionReason, setRejectionReason] = useState('')
  const applications = useQuery({
    queryKey: ['marketplace-applications'],
    queryFn: async () => (await api.request<{ data: Page<Application> }>({ url: '/admin/marketplace/applications' })).data.data,
  })
  const applicationDetail = useQuery({
    queryKey: ['marketplace-application', selectedApplicationId],
    queryFn: async () => (await api.request<{ data: Application }>({ url: `/admin/marketplace/applications/${selectedApplicationId}` })).data.data,
    enabled: selectedApplicationId !== null,
  })

  useEffect(() => {
    if (selectedApplicationId === null) return
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setSelectedApplicationId(null)
        setPendingAction(null)
      }
    }
    document.addEventListener('keydown', closeOnEscape)
    return () => document.removeEventListener('keydown', closeOnEscape)
  }, [selectedApplicationId])

  function openReview(application: Application, action: ReviewAction | null = null) {
    setActionError('')
    setActionSuccess('')
    setSelectedApplicationId(application.id)
    setPendingAction(action)
    setStoreName(application.business_name)
    setStoreSlug(defaultStoreSlug(application.business_name, application.id))
    setRejectionReason('')
  }

  function closeReview() {
    setSelectedApplicationId(null)
    setPendingAction(null)
  }

  function beginAction(action: ReviewAction) {
    setActionError('')
    setActionSuccess('')
    setPendingAction(action)
  }

  const review = useMutation({
    mutationFn: async ({ application, action, storeName: requestedStoreName, slug, rejectionReason: requestedReason }: { application: Application; action: ReviewAction; storeName?: string; slug?: string; rejectionReason?: string }) => {
      setActionError('')
      setActionSuccess('')
      if (action === 'approve') {
        if (!requestedStoreName?.trim() || !slug?.trim()) throw new Error('Store name and store slug are required.')
        return api.request({ url: `/admin/marketplace/applications/${application.id}/approve`, method: 'POST', data: { store_name: requestedStoreName.trim(), slug: slug.trim() } })
      }
      if (!requestedReason?.trim()) throw new Error('A rejection reason is required.')
      return api.request({ url: `/admin/marketplace/applications/${application.id}/reject`, method: 'POST', data: { rejection_reason: requestedReason.trim() } })
    },
    onSuccess: async (_response, variables) => {
      setPendingAction(null)
      setActionSuccess(variables.action === 'approve' ? 'Seller application approved.' : 'Seller application rejected.')
      await Promise.all([
        client.invalidateQueries({ queryKey: ['marketplace-applications'] }),
        client.invalidateQueries({ queryKey: ['marketplace-sellers'] }),
        client.invalidateQueries({ queryKey: ['marketplace-application', selectedApplicationId] }),
      ])
    },
    onError: (error) => {
      setActionSuccess('')
      setActionError(apiErrorMessage(error))
    },
  })

  if (applications.isLoading) return <div className="feedback"><LoaderCircle className="spin" size={18} /> Loading seller applications…</div>
  if (applications.isError) return <Feedback message={apiErrorMessage(applications.error)} retry={() => applications.refetch()} />

  const rows = applications.data?.data ?? []
  const selectedApplication = applicationDetail.data

  return <div className="page-stack">
    <div className="marketplace-connection-note"><span className="connection-dot" /><div><strong>Connected to seller applications</strong><p>New applications from <code>/account/seller-application</code> appear here after submission.</p></div></div>
    {actionError ? <Feedback message={actionError} /> : null}
    {actionSuccess ? <div className="success-box" role="status">{actionSuccess}</div> : null}
    <div className="panel table-panel"><table><thead><tr><th>Business</th><th>Applicant</th><th>Details</th><th>Status</th><th>Review</th></tr></thead><tbody>{rows.map((application) => <tr key={application.id}><td><strong>{application.business_name}</strong><small>{application.business_type ?? 'Business type not provided'}</small></td><td>{application.user?.name ?? 'Unknown applicant'}<small>{application.user?.email ?? 'No email'}</small></td><td><small>{application.documents?.length ?? 0} verification document(s)</small><small>{application.approval_history?.length ?? 0} status event(s)</small></td><td><span className={'status status-' + application.application_status}>{application.application_status}</span>{application.rejection_reason ? <small>{application.rejection_reason}</small> : null}</td><td><div className="row-actions"><button className="text-button" type="button" onClick={() => openReview(application)} disabled={review.isPending} aria-label={`Review seller application ${application.id}`}><FileText size={16} />Review</button>{['pending', 'submitted', 'under_review'].includes(application.application_status) ? <><button className="icon-button" title="Approve application" aria-label={`Approve application ${application.id}`} onClick={() => openReview(application, 'approve')} disabled={review.isPending}><Check size={17} /></button><button className="icon-button danger" title="Reject application" aria-label={`Reject application ${application.id}`} onClick={() => openReview(application, 'reject')} disabled={review.isPending}><X size={17} /></button></> : null}</div></td></tr>)}</tbody></table>{!rows.length && <div className="empty-state"><h3>No seller applications yet</h3><p>Ask a customer to submit an application from their account page.</p></div>}</div>
    {selectedApplicationId !== null ? <div className="marketplace-modal-backdrop" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget) closeReview() }}><section className="marketplace-review-modal" role="dialog" aria-modal="true" aria-labelledby="seller-application-review-title"><header className="marketplace-review-heading"><div><span className="eyebrow">SELLER APPLICATION</span><h2 id="seller-application-review-title">{selectedApplication?.business_name ?? `Application #${selectedApplicationId}`}</h2><p>Review the submitted seller information and approval history.</p></div><button className="icon-button" type="button" aria-label="Close seller application review" onClick={closeReview}><X size={20} /></button></header>{applicationDetail.isLoading ? <div className="feedback"><LoaderCircle className="spin" size={18} /> Loading application details…</div> : applicationDetail.isError ? <Feedback message={apiErrorMessage(applicationDetail.error)} retry={() => applicationDetail.refetch()} /> : selectedApplication ? <><div className="marketplace-review-status"><span className={'status status-' + selectedApplication.application_status}>{selectedApplication.application_status}</span><span>Application #{selectedApplication.id}</span><span>Submitted {selectedApplication.submitted_at ? new Date(selectedApplication.submitted_at).toLocaleString() : 'Not recorded'}</span></div><div className="marketplace-review-grid"><section><h3>Applicant and business</h3><dl className="marketplace-detail-grid"><DetailRecord label="Applicant" value={selectedApplication.user?.name} /><DetailRecord label="Email" value={selectedApplication.user?.email} /><DetailRecord label="Business name" value={selectedApplication.business_name} /><DetailRecord label="Business type" value={selectedApplication.business_type} /></dl><h3>Contact details</h3><dl className="marketplace-detail-grid">{Object.entries(selectedApplication.contact_details ?? {}).length ? Object.entries(selectedApplication.contact_details ?? {}).map(([key, value]) => <DetailRecord key={key} label={fieldLabel(key)} value={value} />) : <DetailRecord label="Contact details" value={null} />}</dl><h3>Business details</h3><dl className="marketplace-detail-grid">{Object.entries(selectedApplication.business_details ?? {}).length ? Object.entries(selectedApplication.business_details ?? {}).map(([key, value]) => <DetailRecord key={key} label={fieldLabel(key)} value={value} />) : <DetailRecord label="Business details" value={null} />}</dl></section><aside><h3>Submitted documents</h3>{selectedApplication.documents?.length ? <ul className="marketplace-document-list">{selectedApplication.documents.map((document) => <li key={document.id}><FileText size={17} /><span><strong>{fieldLabel(document.document_type)}</strong><small>{fieldLabel(document.status)}</small></span></li>)}</ul> : <p className="marketplace-empty-note">No documents were submitted.</p>}<h3>Approval history</h3>{selectedApplication.approval_history?.length ? <ol className="marketplace-approval-history">{selectedApplication.approval_history.map((event) => <li key={event.id}><strong>{fieldLabel(event.action)}</strong><span>{fieldLabel(event.to_status)} · {event.created_at ? new Date(event.created_at).toLocaleString() : 'Not recorded'}</span>{event.reason ? <p>{event.reason}</p> : null}</li>)}</ol> : <p className="marketplace-empty-note">No approval events recorded.</p>}</aside></div><footer className="marketplace-review-actions">{pendingAction ? <div className="marketplace-decision-form"><strong>{pendingAction === 'approve' ? 'Confirm seller approval' : 'Confirm seller rejection'}</strong>{pendingAction === 'approve' ? <div className="marketplace-decision-fields"><label className="field"><span>Store name</span><input value={storeName} onChange={(event) => setStoreName(event.target.value)} /></label><label className="field"><span>Store slug</span><input value={storeSlug} onChange={(event) => setStoreSlug(event.target.value)} /></label></div> : <label className="field"><span>Rejection reason</span><textarea rows={3} value={rejectionReason} onChange={(event) => setRejectionReason(event.target.value)} /></label>}<div className="button-row"><button className="button secondary" type="button" onClick={() => setPendingAction(null)} disabled={review.isPending}>Cancel</button><button className="button primary" type="button" disabled={review.isPending || (pendingAction === 'approve' ? !storeName.trim() || !storeSlug.trim() : !rejectionReason.trim())} onClick={() => review.mutate({ application: selectedApplication, action: pendingAction, storeName, slug: storeSlug, rejectionReason })}>{review.isPending ? 'Saving…' : pendingAction === 'approve' ? 'Confirm approval' : 'Confirm rejection'}</button></div></div> : ['pending', 'submitted', 'under_review'].includes(selectedApplication.application_status) ? <><button className="button primary" type="button" disabled={review.isPending} onClick={() => beginAction('approve')}><Check size={16} />Approve</button><button className="button secondary" type="button" disabled={review.isPending} onClick={() => beginAction('reject')}><X size={16} />Reject</button></> : <span className="muted">This application has already been reviewed.</span>}{actionError ? <span className="error-text" role="alert">{actionError}</span> : null}</footer></> : null}</section></div> : null}
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
