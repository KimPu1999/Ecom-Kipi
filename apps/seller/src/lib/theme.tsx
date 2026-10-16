import { createContext, useContext, useLayoutEffect, useMemo, useState, type PropsWithChildren } from 'react'
import { useLanguage } from '../../../../packages/i18n/src'

export type SellerTheme = 'light' | 'dark'

export const SELLER_THEME_STORAGE_KEY = 'kipi.seller.theme'

function readStoredTheme(): SellerTheme {
  if (typeof window === 'undefined') return 'light'
  try {
    return window.localStorage.getItem(SELLER_THEME_STORAGE_KEY) === 'dark' ? 'dark' : 'light'
  } catch {
    return 'light'
  }
}

function applyTheme(theme: SellerTheme) {
  if (typeof document === 'undefined') return
  document.documentElement.dataset.sellerTheme = theme
  document.documentElement.style.colorScheme = theme
}

type SellerThemeContextValue = {
  theme: SellerTheme
  setTheme: (theme: SellerTheme) => void
}

const SellerThemeContext = createContext<SellerThemeContextValue | null>(null)

export function SellerThemeProvider({ children }: PropsWithChildren) {
  const [theme, setThemeState] = useState<SellerTheme>(readStoredTheme)

  useLayoutEffect(() => {
    applyTheme(theme)
  }, [theme])

  const setTheme = (nextTheme: SellerTheme) => {
    setThemeState(nextTheme)
    applyTheme(nextTheme)
    try {
      window.localStorage.setItem(SELLER_THEME_STORAGE_KEY, nextTheme)
    } catch {
      // The visual preference still applies when browser storage is unavailable.
    }
  }

  const value = useMemo(() => ({ theme, setTheme }), [theme])
  return <SellerThemeContext.Provider value={value}>{children}</SellerThemeContext.Provider>
}

export function useSellerTheme() {
  const context = useContext(SellerThemeContext)
  if (!context) throw new Error('useSellerTheme must be used inside SellerThemeProvider')
  return context
}

export function ThemeSwitcher() {
  const { theme, setTheme } = useSellerTheme()
  const { t } = useLanguage()

  return <div className="theme-switcher" role="group" aria-label={t('Theme preference')}>
    <button type="button" className={theme === 'light' ? 'selected' : ''} aria-pressed={theme === 'light'} aria-label={t('Light mode')} title={t('Light mode')} onClick={() => setTheme('light')}>
      <span aria-hidden="true">☀</span><span className="theme-label">{t('Light')}</span>
    </button>
    <button type="button" className={theme === 'dark' ? 'selected' : ''} aria-pressed={theme === 'dark'} aria-label={t('Dark mode')} title={t('Dark mode')} onClick={() => setTheme('dark')}>
      <span aria-hidden="true">☾</span><span className="theme-label">{t('Dark')}</span>
    </button>
  </div>
}
