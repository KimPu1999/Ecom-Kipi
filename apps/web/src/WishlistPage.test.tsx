import '@testing-library/jest-dom/vitest'
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { MemoryRouter } from 'react-router-dom'
import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest'
import { LanguageProvider } from '../../../packages/i18n/src'
import { WishlistPage } from './pages/AccountPages'

const storefrontApiMock = vi.hoisted(() => ({
  wishlist: vi.fn(),
  removeWishlist: vi.fn(),
  clearWishlist: vi.fn(),
  addCartItem: vi.fn(),
}))

vi.mock('./services/storefrontApi', () => ({ storefrontApi: storefrontApiMock }))

const firstProduct = {
  id: 31,
  name: 'T-Shirt',
  slug: 't-shirt',
  description: 'Everyday cotton tee.',
  status: 'published',
  is_featured: false,
  category: { id: 1, name: 'Clothing', slug: 'clothing', description: null, color: '#2563eb', is_active: true },
  seller: { id: 5, store_name: 'Kipi Apparel', slug: 'kipi-apparel' },
  images: [],
  variants: [{ id: 41, sku: 'TSHIRT-1', price_minor: 15000, compare_at_price_minor: 20000, currency: 'MMK', attributes: { size: 'M' }, is_active: true, available_quantity: 4 }],
}

const secondProduct = {
  ...firstProduct,
  id: 32,
  name: 'Canvas Cap',
  slug: 'canvas-cap',
  category: { ...firstProduct.category, name: 'Accessories', slug: 'accessories' },
  variants: [{ ...firstProduct.variants[0], id: 42, sku: 'CAP-1', price_minor: 12000, compare_at_price_minor: null }],
}

function renderWishlist() {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false, staleTime: 0 } } })
  return render(
    <QueryClientProvider client={queryClient}>
      <LanguageProvider>
        <MemoryRouter initialEntries={['/account/wishlist']}>
          <WishlistPage />
        </MemoryRouter>
      </LanguageProvider>
    </QueryClientProvider>,
  )
}

describe('customer wishlist page', () => {
  afterEach(() => {
    cleanup()
    vi.restoreAllMocks()
  })

  beforeEach(() => {
    vi.clearAllMocks()
    storefrontApiMock.clearWishlist.mockResolvedValue({ data: null })
    storefrontApiMock.removeWishlist.mockResolvedValue({ data: null })
    storefrontApiMock.addCartItem.mockResolvedValue({ data: { item_count: 1 } })
  })

  test('loads persisted items, shows the real count, and filters by search and category', async () => {
    storefrontApiMock.wishlist.mockResolvedValue({ data: { products: [firstProduct, secondProduct], product_ids: [31, 32] } })

    renderWishlist()

    expect(await screen.findByRole('heading', { name: 'My Wishlist' })).toBeInTheDocument()
    expect(screen.getByText('2', { selector: '.wishlist-summary-bar strong' })).toBeInTheDocument()
    expect(screen.getByRole('link', { name: 'T-Shirt' })).toBeInTheDocument()
    expect(screen.getByRole('link', { name: 'Canvas Cap' })).toBeInTheDocument()

    fireEvent.change(screen.getByRole('textbox', { name: 'Search saved products' }), { target: { value: 'cap' } })
    expect(screen.queryByRole('link', { name: 'T-Shirt' })).not.toBeInTheDocument()
    expect(screen.getByRole('link', { name: 'Canvas Cap' })).toBeInTheDocument()

    fireEvent.click(screen.getByRole('button', { name: 'Clear search' }))
    fireEvent.change(screen.getByDisplayValue('All categories'), { target: { value: 'clothing' } })
    expect(screen.getByRole('link', { name: 'T-Shirt' })).toBeInTheDocument()
    expect(screen.queryByRole('link', { name: 'Canvas Cap' })).not.toBeInTheDocument()
  })

  test('removes an item through the real wishlist action and refreshes the count', async () => {
    storefrontApiMock.wishlist.mockResolvedValueOnce({ data: { products: [firstProduct, secondProduct], product_ids: [31, 32] } }).mockResolvedValueOnce({ data: { products: [secondProduct], product_ids: [32] } })

    renderWishlist()
    fireEvent.click(await screen.findByRole('button', { name: 'Remove T-Shirt from wishlist' }))

    await waitFor(() => expect(storefrontApiMock.removeWishlist.mock.calls[0]?.[0]).toBe(31))
    await waitFor(() => expect(screen.getByText('1', { selector: '.wishlist-summary-bar strong' })).toBeInTheDocument())
    expect(screen.queryByRole('link', { name: 'T-Shirt' })).not.toBeInTheDocument()
    expect(screen.getByRole('link', { name: 'Canvas Cap' })).toBeInTheDocument()
  })

  test('keeps an item saved when Add to Cart fails and shows the API error', async () => {
    storefrontApiMock.wishlist.mockResolvedValue({ data: { products: [firstProduct], product_ids: [31] } })
    storefrontApiMock.addCartItem.mockRejectedValue(new Error('Item is no longer available'))

    renderWishlist()
    fireEvent.click(await screen.findByRole('button', { name: 'Add to cart' }))

    await waitFor(() => expect(screen.getByRole('alert')).toHaveTextContent('Item is no longer available'))
    expect(screen.getByRole('link', { name: 'T-Shirt' })).toBeInTheDocument()
    expect(storefrontApiMock.removeWishlist).not.toHaveBeenCalled()
  })

  test('renders the empty state and supports retry after a wishlist API error', async () => {
    storefrontApiMock.wishlist.mockRejectedValueOnce(new Error('Wishlist service unavailable')).mockResolvedValueOnce({ data: { products: [], product_ids: [] } })

    renderWishlist()

    expect(await screen.findByRole('alert')).toHaveTextContent('We could not load your wishlist.')
    fireEvent.click(screen.getByRole('button', { name: 'Retry' }))
    expect(await screen.findByRole('heading', { name: 'Your wishlist is empty' })).toBeInTheDocument()
    expect(screen.getByRole('link', { name: /Explore Products/ })).toHaveAttribute('href', '/products')
  })
})
