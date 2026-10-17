import '@testing-library/jest-dom/vitest'
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { MemoryRouter, Route, Routes, useLocation } from 'react-router-dom'
import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest'
import { LanguageProvider } from '../../../packages/i18n/src'
import { CheckoutPage } from './pages/CheckoutPage'
import { OrderDetailPage } from './pages/AccountPages'

const storefrontApiMock = vi.hoisted(() => ({
  addresses: vi.fn(),
  cart: vi.fn(),
  shippingMethods: vi.fn(),
  manualPaymentMethods: vi.fn(),
  checkoutPreview: vi.fn(),
  confirmCheckout: vi.fn(),
  order: vi.fn(),
  cancelOrder: vi.fn(),
}))

vi.mock('./services/storefrontApi', () => ({ storefrontApi: storefrontApiMock }))

function LocationProbe() {
  const location = useLocation()
  return <output data-testid="location">{location.pathname}</output>
}

function renderWithProviders(ui: React.ReactNode, initialEntries: string[]) {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false, staleTime: 30_000 } } })
  const rendered = render(
    <QueryClientProvider client={queryClient}>
      <LanguageProvider>
        <MemoryRouter initialEntries={initialEntries}>
          <LocationProbe />
          {ui}
        </MemoryRouter>
      </LanguageProvider>
    </QueryClientProvider>,
  )
  return { ...rendered, queryClient }
}

describe('customer order flow navigation', () => {
  afterEach(() => cleanup())

  beforeEach(() => {
    vi.clearAllMocks()
    storefrontApiMock.addresses.mockResolvedValue({ data: [{ id: 1, is_default: true, recipient_name: 'Customer', phone: '0912345678', line1: 'Main Street', city: 'Yangon', country: 'MM' }] })
    storefrontApiMock.cart.mockResolvedValue({ data: { item_count: 1, items: [{ id: 1, quantity: 1, line_total_minor: 1000, variant: { sku: 'SKU-1', currency: 'MMK', product: { name: 'Test product' } } }] } })
    storefrontApiMock.shippingMethods.mockResolvedValue({ data: [{ id: 1, name: 'Standard delivery', description: '', price_minor: 0, currency: 'MMK' }] })
    storefrontApiMock.manualPaymentMethods.mockResolvedValue({ data: [] })
    storefrontApiMock.checkoutPreview.mockResolvedValue({ data: { subtotal_minor: 1000, discount_minor: 0, shipping_minor: 0, tax_minor: 0, grand_total_minor: 1000, currency: 'MMK' } })
  })

  test('confirms checkout and navigates to the created order detail', async () => {
    storefrontApiMock.confirmCheckout.mockResolvedValue({ data: { id: 42 } })

    renderWithProviders(<CheckoutPage />, ['/checkout'])

    fireEvent.click(await screen.findByRole('button', { name: 'Confirm order' }))
    expect(screen.getByRole('alertdialog')).toHaveTextContent('After confirmation, you cannot cancel')
    fireEvent.click(screen.getByRole('button', { name: 'Confirm Order' }))

    await waitFor(() => expect(storefrontApiMock.confirmCheckout).toHaveBeenCalledTimes(1))
    await waitFor(() => expect(screen.getByTestId('location')).toHaveTextContent('/account/orders/42'))
  })

  test('refreshes the checkout preview when the cart lines change', async () => {
    const firstCart = { item_count: 1, items: [{ id: 1, quantity: 1, line_total_minor: 15000, variant: { id: 1, sku: 'TSHIRT-1', price_minor: 15000, currency: 'MMK', attributes: null, product: { name: 'T-Shirt' } } }] }
    const secondCart = { item_count: 2, items: [...firstCart.items, { id: 2, quantity: 1, line_total_minor: 200000, variant: { id: 2, sku: 'DEMO-1', price_minor: 200000, currency: 'MMK', attributes: null, product: { name: 'Demo' } } }] }
    storefrontApiMock.cart.mockResolvedValue({ data: firstCart })
    storefrontApiMock.checkoutPreview
      .mockResolvedValueOnce({ data: { subtotal_minor: 15000, discount_minor: 0, shipping_minor: 0, tax_minor: 0, grand_total_minor: 15000, currency: 'MMK', item_count: 1 } })
      .mockResolvedValueOnce({ data: { subtotal_minor: 215000, discount_minor: 0, shipping_minor: 0, tax_minor: 0, grand_total_minor: 215000, currency: 'MMK', item_count: 2 } })

    const { queryClient } = renderWithProviders(<CheckoutPage />, ['/checkout'])

    await waitFor(() => expect(screen.getAllByText('15,000 MMK').length).toBeGreaterThan(0))
    queryClient.setQueryData(['cart'], { data: secondCart })

    await waitFor(() => expect(screen.getAllByText('215,000 MMK').length).toBeGreaterThan(0))
    expect(storefrontApiMock.checkoutPreview).toHaveBeenCalledTimes(2)
  })

  test('confirms cancellation and returns to the product listing', async () => {
    const order = { id: 7, order_number: 'ORD-7', placed_at: null, customer_confirmed: false, payment_status: 'pending', fulfillment_status: 'pending', grand_total_minor: 1000, subtotal_minor: 1000, discount_minor: 0, shipping_minor: 0, tax_minor: 0, currency: 'MMK', items: [], payments: [], shipments: [], status_history: [], shipping_address: { line1: 'Main Street', city: 'Yangon', country: 'MM' } }
    let currentOrder = order
    storefrontApiMock.order.mockImplementation(async () => ({ data: currentOrder }))
    storefrontApiMock.cancelOrder.mockImplementation(async () => {
      currentOrder = { ...currentOrder, fulfillment_status: 'cancelled' }
      return { data: currentOrder }
    })

    renderWithProviders(<Routes><Route path="/account/orders/:id" element={<OrderDetailPage />} /><Route path="/products" element={<div>Products</div>} /></Routes>, ['/account/orders/7'])

    fireEvent.click(await screen.findByRole('button', { name: 'Cancel order' }))
    fireEvent.click(screen.getByRole('button', { name: 'Confirm cancellation' }))

    await waitFor(() => expect(storefrontApiMock.cancelOrder.mock.calls[0]?.[0]).toBe(7))
    await waitFor(() => expect(screen.getByTestId('location')).toHaveTextContent('/products'))
  })

  test('keeps the customer on the order page when cancellation fails', async () => {
    const order = { id: 8, order_number: 'ORD-8', placed_at: null, customer_confirmed: false, payment_status: 'pending', fulfillment_status: 'pending', grand_total_minor: 1000, subtotal_minor: 1000, discount_minor: 0, shipping_minor: 0, tax_minor: 0, currency: 'MMK', items: [], payments: [], shipments: [], status_history: [], shipping_address: { line1: 'Main Street', city: 'Yangon', country: 'MM' } }
    storefrontApiMock.order.mockResolvedValue({ data: order })
    storefrontApiMock.cancelOrder.mockRejectedValue(new Error('Cancellation failed'))

    renderWithProviders(<Routes><Route path="/account/orders/:id" element={<OrderDetailPage />} /><Route path="/products" element={<div>Products</div>} /></Routes>, ['/account/orders/8'])

    fireEvent.click(await screen.findByRole('button', { name: 'Cancel order' }))
    fireEvent.click(screen.getByRole('button', { name: 'Confirm cancellation' }))

    await waitFor(() => expect(screen.getByRole('alert')).toHaveTextContent('Cancellation failed'))
    expect(screen.getByTestId('location')).toHaveTextContent('/account/orders/8')
    expect(storefrontApiMock.cancelOrder).toHaveBeenCalledTimes(1)
  })
})
