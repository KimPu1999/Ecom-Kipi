import { useLanguage } from '../../../../packages/i18n/src'

export function Loading() {
  const { t } = useLanguage()
  return <p role="status">{t('Loading…')}</p>
}
