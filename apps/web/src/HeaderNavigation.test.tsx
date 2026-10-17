import '@testing-library/jest-dom/vitest'
import { render, screen, within } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { MemoryRouter } from 'react-router-dom'
import { beforeEach, describe, expect, test, vi } from 'vitest'
import { LanguageProvider } from '../../../packages/i18n/src'
import { Header } from './components/Header'

const storefrontApiMock = vi.hoisted(() => ({
  cart: vi.fn(),
  wishlist: vi.fn(),
  categories: vi.fn(),
  brands: vi.fn(),
  stores: vi.fn(),
}))

vi.mock('./services/storefrontApi', () => ({ storefrontApi: storefrontApiMock }))

function renderHeader() {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  return render(
    <QueryClientProvider client={queryClient}>
      <LanguageProvider>
        <MemoryRouter>
          <Header />
        </MemoryRouter>
      </LanguageProvider>
    </QueryClientProvider>,
  )
}

describe('customer header navigation', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    storefrontApiMock.cart.mockResolvedValue({ data: { item_count: 0 } })
    storefrontApiMock.wishlist.mockResolvedValue({ data: { product_ids: [] } })
    storefrontApiMock.categories.mockResolvedValue({ data: [] })
    storefrontApiMock.brands.mockResolvedValue({ data: [] })
    storefrontApiMock.stores.mockResolvedValue({ data: [] })
  })

  test('keeps orders out of the standalone header navigation', () => {
    renderHeader()

    const navigation = screen.getByRole('navigation', { name: 'Primary navigation' })
    expect(within(navigation).queryByRole('link', { name: /^Order$/ })).not.toBeInTheDocument()
    expect(within(navigation).queryByRole('link', { name: /^Orders$/ })).not.toBeInTheDocument()
    expect(screen.getByRole('link', { name: 'Sign in' })).toHaveAttribute('href', '/login')
  })
})
