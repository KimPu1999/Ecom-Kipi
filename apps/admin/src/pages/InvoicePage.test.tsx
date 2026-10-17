import '@testing-library/jest-dom/vitest'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { afterEach, expect, test, vi } from 'vitest'
import { LanguageProvider } from '../store/language'
import { adminApi } from '../services/adminApi'
import type { Order } from '../types/admin'
import { InvoicePage } from './InvoicePage'

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
  shipping_address: { name: 'Thawng Kim', city: 'Yangon' },
  user: { id: 7, name: 'Thawng Kim', email: 'thawng@example.com', phone: '09950000000', status: 'active' },
  items: [{ id: 1, product_name: 'Blue shirt', sku: 'SHIRT-BLUE-M', quantity: 2, unit_price_minor: 60000, line_total_minor: 120000 }],
  payments: [{ id: 1, provider: 'cod', status: 'pending', amount_minor: 172500, currency: 'MMK', provider_payment_id: null, metadata: null }],
  shipments: [],
}

afterEach(() => {
  cleanup()
  vi.restoreAllMocks()
})

test('renders the selected order invoice with pending payment wording and prints it', async () => {
  vi.spyOn(adminApi, 'order').mockResolvedValue(order)
  const print = vi.spyOn(window, 'print').mockImplementation(() => undefined)
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } })

  render(<QueryClientProvider client={queryClient}><LanguageProvider><MemoryRouter initialEntries={['/admin/orders/41/invoice']}><Routes><Route path="/admin/orders/:id/invoice" element={<InvoicePage />} /></Routes></MemoryRouter></LanguageProvider></QueryClientProvider>)

  expect(await screen.findByRole('heading', { name: 'Invoice' })).toBeInTheDocument()
  expect(screen.getAllByText('INV-KIPI-ORD-0041').length).toBeGreaterThan(0)
  expect(screen.getByText('Blue shirt')).toBeInTheDocument()
  expect(screen.getByText('Payment is not confirmed. This document is not a payment receipt.')).toBeInTheDocument()
  expect(screen.getAllByText('172,500 MMK').length).toBeGreaterThan(0)

  fireEvent.click(screen.getByRole('button', { name: 'Print invoice' }))
  expect(print).toHaveBeenCalledTimes(1)
  expect(adminApi.order).toHaveBeenCalledWith(41)
})
