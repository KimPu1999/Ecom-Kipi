import { Link } from 'react-router-dom'
import { useLanguage } from '../../../../packages/i18n/src'

export function NotFound() {
  const { t } = useLanguage()
  return <section className="narrow-page not-found"><span className="eyebrow">{t('404 · Page not found')}</span><h1>{t('That page wandered off.')}</h1><p>{t('Let’s get you back to the good stuff.')}</p><div className="actions"><Link className="button primary" to="/">{t('Return home')}</Link><Link className="button secondary" to="/products">{t('Browse products')}</Link></div></section>
}
