import '@testing-library/jest-dom/vitest'
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { MemoryRouter } from 'react-router-dom'
import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest'
import { LanguageProvider } from '../../../packages/i18n/src'
import { CartPage } from './pages/CartPages'

const storefrontApiMock = vi.hoisted(() => ({
  cart: vi.fn(),
  removeCartItem: vi.fn(),
  updateCartItem: vi.fn(),
}))

vi.mock('./services/storefrontApi', () => ({ storefrontApi: storefrontApiMock }))

vi.mock('./store/auth', () => ({
  useAuthStore: (selector: (state: { user: { id: number; name: string; email: string } | null }) => unknown) => selector({ user: { id: 1, name: 'Customer', email: 'customer@example.com' } }),
}))

const firstItem = {
  id: 11,
  quantity: 1,
  line_total_minor: 15000,
  variant: {
    id: 21,
    sku: 'TSHIRT-1',
    price_minor: 15000,
    compare_at_price_minor: null,
    currency: 'MMK',
    attributes: null,
    is_active: true,
    available_quantity: 5,
    product: {
      id: 31,
      name: 'T-Shirt',
      slug: 't-shirt',
      status: 'published',
      seller: null,
      images: [],
      variants: [],
    },
  },
}

const secondItem = {
  ...firstItem,
  id: 12,
  line_total_minor: 20000,
  variant: {
    ...firstItem.variant,
    id: 22,
    sku: 'CAP-1',
    price_minor: 20000,
    product: { ...firstItem.variant.product, id: 32, name: 'Cap', slug: 'cap' },
  },
}

function renderCart() {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false, staleTime: 0 } } })
  return render(
    <QueryClientProvider client={queryClient}>
      <LanguageProvider>
        <MemoryRouter initialEntries={['/cart']}>
          <CartPage />
        </MemoryRouter>
      </LanguageProvider>
    </QueryClientProvider>,
  )
}

describe('customer cart item removal', () => {
  afterEach(() => {
    cleanup()
    vi.restoreAllMocks()
  })

  beforeEach(() => {
    vi.clearAllMocks()
  })

  test('removes an item without a native confirmation and refreshes cart totals', async () => {
    const initialCart = { item_count: 2, subtotal_minor: 35000, items: [firstItem, secondItem] }
    const updatedCart = { item_count: 1, subtotal_minor: 20000, items: [secondItem] }
    storefrontApiMock.cart.mockResolvedValueOnce({ data: initialCart }).mockResolvedValueOnce({ data: updatedCart })
    storefrontApiMock.removeCartItem.mockResolvedValue({ data: updatedCart })
    const confirm = vi.spyOn(window, 'confirm').mockImplementation(() => {
      throw new Error('The cart must not use a native confirmation popup')
    })

    renderCart()

    fireEvent.click(await screen.findByRole('button', { name: 'Remove T-Shirt from cart' }))

    await waitFor(() => expect(storefrontApiMock.removeCartItem.mock.calls[0]?.[0]).toBe(11))
    await waitFor(() => expect(screen.getByText('1 items in your cart.')).toBeInTheDocument())
    expect(screen.queryByText('T-Shirt')).not.toBeInTheDocument()
    expect(screen.getByText('Cap')).toBeInTheDocument()
    expect(screen.getAllByText('20,000 MMK').length).toBeGreaterThan(0)
    expect(confirm).not.toHaveBeenCalled()
  })

  test('shows the empty-cart state after removing the last item', async () => {
    storefrontApiMock.cart.mockResolvedValueOnce({ data: { item_count: 1, subtotal_minor: 15000, items: [firstItem] } }).mockResolvedValueOnce({ data: { item_count: 0, subtotal_minor: 0, items: [] } })
    storefrontApiMock.removeCartItem.mockResolvedValue({ data: { item_count: 0, subtotal_minor: 0, items: [] } })

    renderCart()
    fireEvent.click(await screen.findByRole('button', { name: 'Remove T-Shirt from cart' }))

    await waitFor(() => expect(screen.getByText('Your cart is empty')).toBeInTheDocument())
    expect(screen.queryByText('T-Shirt')).not.toBeInTheDocument()
  })

  test('keeps the item visible and shows an inline error when removal fails', async () => {
    storefrontApiMock.cart.mockResolvedValue({ data: { item_count: 1, subtotal_minor: 15000, items: [firstItem] } })
    storefrontApiMock.removeCartItem.mockRejectedValue(new Error('Removal failed'))

    renderCart()
    fireEvent.click(await screen.findByRole('button', { name: 'Remove T-Shirt from cart' }))

    await waitFor(() => expect(screen.getAllByText('Removal failed').length).toBeGreaterThan(0))
    expect(screen.getByText('T-Shirt')).toBeInTheDocument()
    expect(storefrontApiMock.cart).toHaveBeenCalledTimes(1)
  })
})
