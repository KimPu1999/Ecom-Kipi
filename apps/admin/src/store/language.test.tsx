import '@testing-library/jest-dom/vitest'
import { fireEvent, render, screen } from '@testing-library/react'
import { expect, test, beforeEach } from 'vitest'
import { LanguageProvider, LanguageSwitcher, useLanguage } from './language'
import { missingTranslations } from '../../../../packages/i18n/src'

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

test('keeps the shared core UI vocabulary translated', () => {
  expect(missingTranslations([
    'Navigation',
    'Dashboard',
    'Products',
    'Orders',
    'Settings',
    'Search',
    'Save',
    'Cancel',
    'Language',
    'English',
    'Burmese',
  ])).toEqual([])
})

test('language selector changes the shared preference from its menu', () => {
  render(<LanguageProvider><LanguageSwitcher /></LanguageProvider>)

  fireEvent.click(screen.getByRole('button', { name: 'Language' }))
  fireEvent.click(screen.getByRole('menuitemradio', { name: 'မြန်မာ' }))

  expect(localStorage.getItem('kipi.language')).toBe('my')
  expect(localStorage.getItem('kipi.admin.language')).toBe('my')
})
