import { Link } from 'react-router-dom'
import { useLanguage } from '../store/language'

export function Unauthorized() { const { t } = useLanguage(); return <section className="admin-card"><h1>{t('Unauthorized')}</h1><p>{t('Your account does not have admin access.')}</p><Link to="/admin/login">{t('Try another account')}</Link></section> }
export function NotFound() { const { t } = useLanguage(); return <section className="admin-card"><h1>{t('Page not found')}</h1><Link to="/admin">{t('Back to dashboard')}</Link></section> }
