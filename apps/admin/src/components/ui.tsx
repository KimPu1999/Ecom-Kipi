import type { PropsWithChildren, ReactNode } from 'react'
import { useRef } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import { AlertCircle, ArrowLeft, ChevronLeft, ChevronRight, LoaderCircle, Search, X } from 'lucide-react'
import { useLanguage } from '../store/language'

export function PageHeader({ action }: { eyebrow?: string; title?: string; description?: string; action?: ReactNode }) {
  return action ? <div className="page-actions">{action}</div> : null
}

function browserHistoryIndex() {
  if (typeof window === 'undefined') return null
  const index = window.history.state?.idx
  return typeof index === 'number' ? index : null
}

export function BackButton({ fallback = '/admin' }: { fallback?: string }) {
  const location = useLocation()
  const navigate = useNavigate()
  const initialHistoryIndex = useRef(browserHistoryIndex())
  const currentHistoryIndex = browserHistoryIndex()
  const canGoBack = currentHistoryIndex !== null && initialHistoryIndex.current !== null && currentHistoryIndex > initialHistoryIndex.current
  const isDashboardWithoutHistory = location.pathname === '/admin' && !canGoBack

  if (isDashboardWithoutHistory) return null

  function goBack() {
    if (canGoBack) {
      navigate(-1)
      return
    }
    navigate(fallback.startsWith('/admin') ? fallback : '/admin', { replace: true })
  }

  return <button type="button" className="admin-back-button" onClick={goBack} aria-label="Back"><ArrowLeft size={16} aria-hidden="true" /><span>Back</span></button>
}

export function Card({ children, className = '' }: PropsWithChildren<{ className?: string }>) {
  return <section className={'card ' + className}>{children}</section>
}

export function StatusBadge({ value }: { value: string | boolean }) {
  const { t } = useLanguage()
  const label = typeof value === 'boolean' ? (value ? 'Active' : 'Inactive') : value.replaceAll('_', ' ')
  const translated = t(label.charAt(0).toUpperCase() + label.slice(1))
  return <span className={'status status-' + label.toLowerCase().replaceAll(' ', '-')}>{translated}</span>
}

export function LoadingState() {
  const { t } = useLanguage()
  return <div className="feedback"><LoaderCircle className="spin" size={24} /><span>{t('Loading data…')}</span></div>
}

export function ErrorState({ message = 'Unable to load this data.' }: { message?: string }) {
  const { t } = useLanguage()
  return <div className="feedback error-box"><AlertCircle size={22} /><span>{t(message)}</span></div>
}

export function EmptyState({ title, message }: { title: string; message: string }) {
  const { t } = useLanguage()
  return <div className="empty-state"><h3>{t(title)}</h3><p>{t(message)}</p></div>
}

export function SearchBox({ value, onChange, placeholder = 'Search…' }: { value: string; onChange: (value: string) => void; placeholder?: string }) {
  const { t } = useLanguage()
  const label = t(placeholder)
  const inputRef = useRef<HTMLInputElement>(null)

  const clearSearch = () => {
    onChange('')
    inputRef.current?.focus()
  }

  return <div className="search-box">
    <Search size={18} aria-hidden="true" />
    <input ref={inputRef} className="search-box-input" type="text" value={value} onChange={(event) => onChange(event.target.value)} placeholder={label} aria-label={label} />
    {value.length > 0 ? <button type="button" className="search-box-clear" aria-label={t('Clear search')} onMouseDown={(event) => event.preventDefault()} onClick={clearSearch}><X size={15} aria-hidden="true" /></button> : null}
  </div>
}

export function Pagination({ page, pages, onChange }: { page: number; pages: number; onChange: (page: number) => void }) {
  const { t } = useLanguage()
  if (pages <= 1) return null
  return <div className="pagination"><button disabled={page <= 1} onClick={() => onChange(page - 1)} aria-label={t('Previous page')}><ChevronLeft size={17} /></button><span>{t('Page {page} of {pages}', { page, pages })}</span><button disabled={page >= pages} onClick={() => onChange(page + 1)} aria-label={t('Next page')}><ChevronRight size={17} /></button></div>
}

export function ConfirmButton({ children, onConfirm }: PropsWithChildren<{ onConfirm: () => void }>) {
  const { t } = useLanguage()
  return <button className="text-button danger-text" onClick={() => { if (window.confirm(t('Are you sure? This action is recorded.'))) onConfirm() }}>{children}</button>
}
