import { Link } from 'react-router-dom'
import { useLanguage } from '../../../../packages/i18n/src'

export function Navigation() {
  const { t } = useLanguage()
  return <nav aria-label={t('Primary navigation')}><Link to="/products">{t('Products')}</Link><Link to="/cart">{t('Cart')}</Link><Link to="/account">{t('Account')}</Link></nav>
}
