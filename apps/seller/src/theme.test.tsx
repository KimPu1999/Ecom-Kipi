import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { LanguageProvider } from '../../../packages/i18n/src'
import { SELLER_THEME_STORAGE_KEY, SellerThemeProvider, ThemeSwitcher } from './lib/theme'

function renderThemeSwitcher() {
  return render(<LanguageProvider><SellerThemeProvider><ThemeSwitcher /></SellerThemeProvider></LanguageProvider>)
}

describe('seller theme switcher', () => {
  beforeEach(() => {
    window.localStorage.clear()
    document.documentElement.dataset.sellerTheme = 'light'
  })

  afterEach(() => {
    cleanup()
  })

  it('switches themes immediately and persists the selected value', () => {
    renderThemeSwitcher()

    const light = screen.getByRole('button', { name: 'Light mode' })
    const dark = screen.getByRole('button', { name: 'Dark mode' })
    expect(light.getAttribute('aria-pressed')).toBe('true')
    expect(dark.getAttribute('aria-pressed')).toBe('false')

    fireEvent.click(dark)
    expect(document.documentElement.dataset.sellerTheme).toBe('dark')
    expect(window.localStorage.getItem(SELLER_THEME_STORAGE_KEY)).toBe('dark')
    expect(dark.getAttribute('aria-pressed')).toBe('true')

    fireEvent.click(light)
    expect(document.documentElement.dataset.sellerTheme).toBe('light')
    expect(window.localStorage.getItem(SELLER_THEME_STORAGE_KEY)).toBe('light')
  })

  it('restores dark mode from the saved preference', () => {
    window.localStorage.setItem(SELLER_THEME_STORAGE_KEY, 'dark')
    renderThemeSwitcher()

    expect(document.documentElement.dataset.sellerTheme).toBe('dark')
    expect(screen.getByRole('button', { name: 'Dark mode' }).getAttribute('aria-pressed')).toBe('true')
  })
})
