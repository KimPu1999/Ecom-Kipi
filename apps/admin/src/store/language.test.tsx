import '@testing-library/jest-dom/vitest'
import { fireEvent, render, screen } from '@testing-library/react'
import { expect, test, beforeEach } from 'vitest'
import { LanguageProvider, useLanguage } from './language'

function LanguageProbe() {
  const { language, setLanguage, t } = useLanguage()
  return <div><span>{t('Navigation')}</span><button onClick={() => setLanguage(language === 'en' ? 'my' : 'en')}>{language}</button></div>
}

beforeEach(() => localStorage.clear())

test('switches to Burmese and persists the selected language', () => {
  const view = render(<LanguageProvider><LanguageProbe /></LanguageProvider>)

  expect(screen.getByText('Navigation')).toBeInTheDocument()
  fireEvent.click(screen.getByRole('button', { name: 'en' }))

  expect(screen.getByText('လမ်းညွှန်')).toBeInTheDocument()
  expect(localStorage.getItem('kipi.admin.language')).toBe('my')

  view.unmount()
  render(<LanguageProvider><LanguageProbe /></LanguageProvider>)
  expect(screen.getByText('လမ်းညွှန်')).toBeInTheDocument()
})
