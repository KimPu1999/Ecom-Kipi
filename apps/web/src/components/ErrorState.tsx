import { useLanguage } from '../../../../packages/i18n/src'

export function ErrorState({ message = 'Something went wrong.' }: { message?: string }) {
  const { t } = useLanguage()
  return <p role="alert" className="error">{t(message)}</p>
}
