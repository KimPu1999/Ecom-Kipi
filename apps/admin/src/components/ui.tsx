import type { PropsWithChildren, ReactNode } from 'react'
import { AlertCircle, ChevronLeft, ChevronRight, LoaderCircle, Search } from 'lucide-react'

export function PageHeader({ action }: { eyebrow?: string; title?: string; description?: string; action?: ReactNode }) {
  return action ? <div className="page-actions">{action}</div> : null
}

export function Card({ children, className = '' }: PropsWithChildren<{ className?: string }>) {
  return <section className={'card ' + className}>{children}</section>
}

export function StatusBadge({ value }: { value: string | boolean }) {
  const label = typeof value === 'boolean' ? (value ? 'Active' : 'Inactive') : value.replaceAll('_', ' ')
  return <span className={'status status-' + label.toLowerCase().replaceAll(' ', '-')}>{label}</span>
}

export function LoadingState() {
  return <div className="feedback"><LoaderCircle className="spin" size={24} /><span>Loading data…</span></div>
}

export function ErrorState({ message = 'Unable to load this data.' }: { message?: string }) {
  return <div className="feedback error-box"><AlertCircle size={22} /><span>{message}</span></div>
}

export function EmptyState({ title, message }: { title: string; message: string }) {
  return <div className="empty-state"><h3>{title}</h3><p>{message}</p></div>
}

export function SearchBox({ value, onChange, placeholder = 'Search…' }: { value: string; onChange: (value: string) => void; placeholder?: string }) {
  return <label className="search-box"><Search size={18} /><input value={value} onChange={(event) => onChange(event.target.value)} placeholder={placeholder} /></label>
}

export function Pagination({ page, pages, onChange }: { page: number; pages: number; onChange: (page: number) => void }) {
  if (pages <= 1) return null
  return <div className="pagination"><button disabled={page <= 1} onClick={() => onChange(page - 1)} aria-label="Previous page"><ChevronLeft size={17} /></button><span>Page {page} of {pages}</span><button disabled={page >= pages} onClick={() => onChange(page + 1)} aria-label="Next page"><ChevronRight size={17} /></button></div>
}

export function ConfirmButton({ children, onConfirm }: PropsWithChildren<{ onConfirm: () => void }>) {
  return <button className="text-button danger-text" onClick={() => { if (window.confirm('Are you sure? This action is recorded.')) onConfirm() }}>{children}</button>
}
