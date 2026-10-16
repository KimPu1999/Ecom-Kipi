import '@testing-library/jest-dom/vitest'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { fireEvent, render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { afterEach, beforeEach, expect, test, vi } from 'vitest'
import { LanguageProvider } from '../store/language'
import { adminApi } from '../services/adminApi'
import type { Order } from '../types/admin'
import { OrdersPage } from './OperationsPages'

const order: Order = {
  id: 41,
  order_number: 'KIPI-ORD-0041',
  subtotal_minor: 180000,
  discount_minor: 10000,
  shipping_minor: 2500,
  tax_minor: 0,
  grand_total_minor: 172500,
  currency: 'MMK',
  payment_status: 'pending',
  fulfillment_status: 'processing',
  placed_at: '2026-10-16T08:00:00.000Z',
  shipping_address: { name: 'Thawng', city: 'Yangon', township: 'Tamwe' },
  user: { id: 7, name: 'Thawng Kim', email: 'thawng@example.com', phone: '09950000000', status: 'active' },
  shipping_method: { id: 1, name: 'Standard delivery', code: 'standard', price_minor: 2500, currency: 'MMK' },
  items: [
    { id: 1, product_name: 'Blue shirt', sku: 'SHIRT-BLUE-M', quantity: 2, unit_price_minor: 60000, line_total_minor: 120000, product_image: null },
    { id: 2, product_name: 'Canvas shoes', sku: 'SHOE-CANVAS-40', quantity: 1, unit_price_minor: 60000, line_total_minor: 60000, product_image: null },
  ],
  payments: [{ id: 1, provider: 'cod', status: 'pending', amount_minor: 172500, currency: 'MMK', provider_payment_id: null, metadata: null }],
  shipments: [{ id: 11, status: 'preparing', delivery_method: 'self_delivery', carrier: 'Kipi Self Delivery', tracking_number: null, internal_tracking_id: 'KIPI-DEL-2026-000041', estimated_delivery_at: '2026-10-20T08:00:00.000Z' }],
  status_history: [],
  notes: [],
  refunds: [],
}

afterEach(() => {
  vi.restoreAllMocks()
})

beforeEach(() => {
  Element.prototype.scrollIntoView = vi.fn()
})

test('opens a structured order detail view from All Orders and returns to the table', async () => {
  vi.spyOn(adminApi, 'orders').mockResolvedValue({ data: [order], meta: { current_page: 1, per_page: 10, last_page: 1, total: 1 } })
  vi.spyOn(adminApi, 'order').mockResolvedValue(order)
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } })

  render(<QueryClientProvider client={queryClient}><LanguageProvider><MemoryRouter initialEntries={['/admin/orders']}><OrdersPage /></MemoryRouter></LanguageProvider></QueryClientProvider>)

  fireEvent.click(await screen.findByRole('button', { name: 'KIPI-ORD-0041' }))

  expect(await screen.findByText('Order overview')).toBeInTheDocument()
  expect(screen.getByText('Customer information')).toBeInTheDocument()
  expect(screen.getByText('Shipping / delivery information')).toBeInTheDocument()
  expect(screen.getByText('Payment information')).toBeInTheDocument()
  expect(screen.getByText('Order items')).toBeInTheDocument()
  expect(screen.getByText('Blue shirt')).toBeInTheDocument()
  expect(screen.getByText('Canvas shoes')).toBeInTheDocument()
  expect(screen.getByText('KIPI-DEL-2026-000041')).toBeInTheDocument()
  expect(screen.getByText('Order summary')).toBeInTheDocument()
  expect(screen.getByText('Order actions')).toBeInTheDocument()

  fireEvent.click(screen.getByRole('button', { name: 'Back' }))
  expect(screen.queryByText('Customer information')).not.toBeInTheDocument()
  expect(screen.getByRole('button', { name: 'KIPI-ORD-0041' })).toBeInTheDocument()
})
