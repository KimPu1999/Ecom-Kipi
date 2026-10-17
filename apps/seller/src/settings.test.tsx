import { afterEach, describe, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { MemoryRouter } from 'react-router-dom'
import { LanguageProvider } from '../../../packages/i18n/src'
import { api } from './lib/api'
import { SellerThemeProvider } from './lib/theme'
import { SettingsPage } from './App'

afterEach(() => {
  cleanup()
  vi.restoreAllMocks()
})

function renderSettings(initialEntry = '/seller/settings') {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  return render(
    <LanguageProvider>
      <SellerThemeProvider>
        <QueryClientProvider client={queryClient}>
          <MemoryRouter initialEntries={[initialEntry]}>
            <SettingsPage />
          </MemoryRouter>
        </QueryClientProvider>
      </SellerThemeProvider>
    </LanguageProvider>,
  )
}

describe('Seller settings', () => {
  it('loads persisted policy text and exposes only real settings destinations', async () => {
    vi.spyOn(api, 'request').mockResolvedValue({ data: { data: { store_policies: { summary: 'Returns accepted within seven days.' } } } } as never)

    renderSettings()

    expect(await screen.findByDisplayValue('Returns accepted within seven days.')).not.toBeNull()
    expect(screen.getByRole('link', { name: /Payout Settings/i }).getAttribute('href')).toBe('/seller/payouts')
    expect(screen.queryByRole('link', { name: /Account & Security/i })).toBeNull()
  })

  it('saves general settings through the existing API and shows confirmation', async () => {
    const request = vi.spyOn(api, 'request').mockImplementation(async (config) => {
      if (config.method === 'PUT') return { data: { data: { store_policies: { summary: 'Updated policy.' } } } } as never
      return { data: { data: { store_policies: { summary: 'Initial policy.' } } } } as never
    })

    renderSettings()

    const policy = await screen.findByLabelText('Store policy summary')
    fireEvent.change(policy, { target: { value: 'Updated policy.' } })
    fireEvent.click(screen.getByRole('button', { name: 'Save settings' }))

    await waitFor(() => expect(request).toHaveBeenCalledWith(expect.objectContaining({
      method: 'PUT',
      url: '/seller/settings',
      data: { store_policies: { summary: 'Updated policy.' } },
    })))
    expect(await screen.findByText('Settings saved.')).not.toBeNull()
  })

  it('renders the existing theme and language controls in appearance settings', async () => {
    vi.spyOn(api, 'request').mockResolvedValue({ data: { data: { store_policies: null } } } as never)

    renderSettings('/seller/settings?section=appearance')

    expect(await screen.findByRole('heading', { name: 'Language & Appearance' })).not.toBeNull()
    expect(screen.getByRole('group', { name: 'Theme preference' })).not.toBeNull()
    expect(screen.getByRole('button', { name: 'Language' })).not.toBeNull()
  })
})
