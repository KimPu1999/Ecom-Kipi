import '@testing-library/jest-dom/vitest'
import { fireEvent, render, screen } from '@testing-library/react'
import { beforeEach, expect, test } from 'vitest'
import { AppearanceProvider, DEFAULT_APPEARANCE, useAppearance } from './appearance'

function AppearanceProbe() {
  const { settings, preview, save, reset } = useAppearance()
  const largeSettings = { ...settings, fontSize: 'large' as const, colors: { ...settings.colors, primary: '#073B9A' } }
  return <div>
    <span data-testid="font-size">{settings.fontSize}</span>
    <span data-testid="primary">{settings.colors.primary}</span>
    <button type="button" onClick={() => preview(largeSettings)}>Preview</button>
    <button type="button" onClick={() => save(largeSettings)}>Save</button>
    <button type="button" onClick={reset}>Reset</button>
  </div>
}

beforeEach(() => {
  window.localStorage.clear()
  document.documentElement.removeAttribute('data-theme')
  document.documentElement.style.cssText = ''
})

test('previews appearance changes, persists saved settings, and resets defaults', () => {
  const view = render(<AppearanceProvider><AppearanceProbe /></AppearanceProvider>)

  expect(screen.getByTestId('font-size')).toHaveTextContent(DEFAULT_APPEARANCE.fontSize)
  fireEvent.click(screen.getByRole('button', { name: 'Preview' }))
  expect(screen.getByTestId('font-size')).toHaveTextContent('large')
  expect(document.documentElement.style.getPropertyValue('--primary')).toBe('#073B9A')
  expect(window.localStorage.getItem('kipi.admin.appearance')).toBeNull()

  fireEvent.click(screen.getByRole('button', { name: 'Save' }))
  expect(window.localStorage.getItem('kipi.admin.appearance')).toContain('large')

  view.unmount()
  render(<AppearanceProvider><AppearanceProbe /></AppearanceProvider>)
  expect(screen.getByTestId('font-size')).toHaveTextContent('large')
  fireEvent.click(screen.getByRole('button', { name: 'Reset' }))
  expect(screen.getByTestId('font-size')).toHaveTextContent(DEFAULT_APPEARANCE.fontSize)
  expect(window.localStorage.getItem('kipi.admin.appearance')).toContain('medium')
})

