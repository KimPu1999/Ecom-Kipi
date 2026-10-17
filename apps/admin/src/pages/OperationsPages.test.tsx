import '@testing-library/jest-dom/vitest'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { MemoryRouter, Route, Routes, useLocation } from 'react-router-dom'
import { afterEach, expect, test, vi } from 'vitest'
import { LanguageProvider } from '../store/language'
import { adminApi } from '../services/adminApi'
import type { Order } from '../types/admin'
import { OrderDetailsPage, OrdersPage } from './OperationsPages'

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
    { id: 1, product_name: 'Blue shirt', sku: 'SHIRT-BLUE-M', quantity: 2, unit_price_minor: 60000, line_total_minor: 120000, product_image: null, seller: { id: 4, store_name: 'Kipi Fashion' } },
    { id: 2, product_name: 'Canvas shoes', sku: 'SHOE-CANVAS-40', quantity: 1, unit_price_minor: 60000, line_total_minor: 60000, product_image: null, seller: { id: 9, store_name: 'Kipi Shoes' } },
  ],
  payments: [{ id: 1, provider: 'cod', status: 'pending', amount_minor: 172500, currency: 'MMK', provider_payment_id: null, metadata: null }],
  shipments: [{ id: 11, status: 'preparing', delivery_method: 'self_delivery', carrier: 'Kipi Self Delivery', tracking_number: null, internal_tracking_id: 'KIPI-DEL-2026-000041', estimated_delivery_at: '2026-10-20T08:00:00.000Z' }],
  status_history: [],
  notes: [],
  refunds: [],
}

const secondOrder: Order = {
  ...order,
  id: 42,
  order_number: 'KIPI-ORD-0042',
  fulfillment_status: 'shipped',
  items: [{ id: 3, product_name: 'Green bag', sku: 'BAG-GREEN', quantity: 1, unit_price_minor: 90000, line_total_minor: 90000, product_image: null }],
  shipments: [],
}

afterEach(() => {
  cleanup()
  vi.restoreAllMocks()
})

function LocationProbe() {
  return <span>{useLocation().pathname}</span>
}

test('navigates from All Orders to a dedicated structured order detail page', async () => {
  vi.spyOn(adminApi, 'orders').mockResolvedValue({ data: [order, secondOrder], meta: { current_page: 1, per_page: 10, last_page: 1, total: 2 } })
  vi.spyOn(adminApi, 'order').mockImplementation(async (id) => id === secondOrder.id ? secondOrder : order)
  vi.spyOn(adminApi, 'updateOrderStatus').mockResolvedValue({ ...order, fulfillment_status: 'shipped' })
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } })

  render(<QueryClientProvider client={queryClient}><LanguageProvider><MemoryRouter initialEntries={['/admin/orders']}><Routes><Route path="/admin/orders" element={<OrdersPage />} /><Route path="/admin/orders/:id" element={<><LocationProbe /><OrderDetailsPage /></>} /></Routes></MemoryRouter></LanguageProvider></QueryClientProvider>)

  fireEvent.click(await screen.findByRole('button', { name: 'View details for KIPI-ORD-0041' }))

  expect(await screen.findByText('/admin/orders/41')).toBeInTheDocument()
  expect(await screen.findByText('Order overview')).toBeInTheDocument()
  expect(screen.getByRole('button', { name: 'Previous order' })).toBeDisabled()
  expect(screen.getByRole('button', { name: 'Next order' })).toBeEnabled()
  expect(screen.getByText('Customer information')).toBeInTheDocument()
  expect(screen.getByText('Shipping / delivery information')).toBeInTheDocument()
  expect(screen.getByText('Payment information')).toBeInTheDocument()
  expect(screen.getByText('Order items')).toBeInTheDocument()
  expect(screen.getByText('Blue shirt')).toBeInTheDocument()
  expect(screen.getByText('Canvas shoes')).toBeInTheDocument()
  expect(screen.getAllByText('Kipi Fashion').length).toBeGreaterThan(0)
  expect(screen.getAllByText('Kipi Shoes').length).toBeGreaterThan(0)
  expect(screen.getByText('KIPI-DEL-2026-000041')).toBeInTheDocument()
  expect(screen.getByText('Order summary')).toBeInTheDocument()
  expect(screen.getByText('Order actions')).toBeInTheDocument()
  expect(screen.getByRole('heading', { name: 'Order overview' })).toBeInTheDocument()
  expect(screen.getByRole('heading', { name: 'Customer information' })).toBeInTheDocument()
  expect(screen.queryByRole('button', { name: 'Customer information' })).not.toBeInTheDocument()
  fireEvent.change(screen.getByRole('combobox', { name: 'Update order status' }), { target: { value: 'shipped' } })
  await waitFor(() => expect(adminApi.updateOrderStatus).toHaveBeenCalledWith(41, 'shipped'))

  fireEvent.click(screen.getByRole('button', { name: 'Next order' }))
  expect(await screen.findByRole('heading', { name: 'KIPI-ORD-0042' })).toBeInTheDocument()
  expect(screen.getAllByText('Seller unavailable').length).toBeGreaterThan(0)
  expect(screen.getByRole('button', { name: 'Previous order' })).toBeEnabled()
  expect(screen.getByRole('button', { name: 'Next order' })).toBeDisabled()

  fireEvent.click(screen.getByRole('button', { name: 'Back' }))
  expect(await screen.findByRole('button', { name: 'View details for KIPI-ORD-0041' })).toBeInTheDocument()
  expect(screen.queryByText('Customer information')).not.toBeInTheDocument()
})

test('loads the correct order details from a direct URL', async () => {
  vi.spyOn(adminApi, 'order').mockResolvedValue(order)
  vi.spyOn(adminApi, 'orders').mockResolvedValue({ data: [order, secondOrder], meta: { current_page: 1, per_page: 100, last_page: 1, total: 2 } })
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } })

  render(<QueryClientProvider client={queryClient}><LanguageProvider><MemoryRouter initialEntries={['/admin/orders/41']}><Routes><Route path="/admin/orders/:id" element={<OrderDetailsPage />} /></Routes></MemoryRouter></LanguageProvider></QueryClientProvider>)

  expect(await screen.findByText('KIPI-DEL-2026-000041')).toBeInTheDocument()
  expect(screen.getByRole('button', { name: 'Previous order' })).toBeDisabled()
  expect(screen.getByRole('button', { name: 'Next order' })).toBeEnabled()
  expect(adminApi.order).toHaveBeenCalledWith(41)
  expect(adminApi.orders).toHaveBeenCalledWith({ per_page: '100' })
})

test('requires in-page confirmation and approves a submitted payment receipt through the real action', async () => {
  const manualOrder: Order = {
    ...order,
    payments: [{ id: 8, provider: 'kbzpay', status: 'pending', amount_minor: 172500, currency: 'MMK', provider_payment_id: null, metadata: { sender_name: 'Customer Sender', sender_phone: '0912345678', transaction_code: 'KBZ-TEST-008' }, receipt: { status: 'submitted', has_file: true } }],
  }
  vi.spyOn(adminApi, 'order').mockResolvedValue(manualOrder)
  vi.spyOn(adminApi, 'orders').mockResolvedValue({ data: [manualOrder], meta: { current_page: 1, per_page: 100, last_page: 1, total: 1 } })
  const approveReceipt = vi.spyOn(adminApi, 'approvePaymentReceipt').mockResolvedValue({})
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } })

  render(<QueryClientProvider client={queryClient}><LanguageProvider><MemoryRouter initialEntries={['/admin/orders/41']}><Routes><Route path="/admin/orders/:id" element={<OrderDetailsPage />} /></Routes></MemoryRouter></LanguageProvider></QueryClientProvider>)

  expect((await screen.findAllByText('KBZPAY')).length).toBeGreaterThan(0)
  expect(screen.getAllByText('KBZ-TEST-008').length).toBeGreaterThan(0)
  expect(screen.getByRole('button', { name: 'View receipt' })).toBeInTheDocument()
  fireEvent.click(screen.getByRole('button', { name: 'Confirm Payment' }))
  expect(screen.getByRole('alertdialog')).toHaveTextContent('approve the submitted receipt')
  const confirmButtons = screen.getAllByRole('button', { name: 'Confirm Payment' })
  fireEvent.click(confirmButtons[confirmButtons.length - 1])

  await waitFor(() => expect(approveReceipt).toHaveBeenCalledWith(8))
})

test('shows the server validation error and keeps payment unconfirmed when verification fails', async () => {
  const manualOrder: Order = {
    ...order,
    payments: [{ id: 9, provider: 'wavepay', status: 'pending', amount_minor: 172500, currency: 'MMK', provider_payment_id: null, metadata: { transaction_code: 'WAVE-TEST-009' } }],
  }
  vi.spyOn(adminApi, 'order').mockResolvedValue(manualOrder)
  vi.spyOn(adminApi, 'orders').mockResolvedValue({ data: [manualOrder], meta: { current_page: 1, per_page: 100, last_page: 1, total: 1 } })
  const verifyManual = vi.spyOn(adminApi, 'verifyManualPayment').mockRejectedValue({ status: 422, message: 'Validation failed', errors: { payment: ['Only pending or processing manual online payments can be verified.'] } })
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } })

  render(<QueryClientProvider client={queryClient}><LanguageProvider><MemoryRouter initialEntries={['/admin/orders/41']}><Routes><Route path="/admin/orders/:id" element={<OrderDetailsPage />} /></Routes></MemoryRouter></LanguageProvider></QueryClientProvider>)

  expect((await screen.findAllByText('WAVE-TEST-009')).length).toBeGreaterThan(0)
  fireEvent.click(screen.getByRole('button', { name: 'Confirm Payment' }))
  fireEvent.click(screen.getAllByRole('button', { name: 'Confirm Payment' })[1])

  expect(await screen.findByRole('alert')).toHaveTextContent('Only pending or processing manual online payments can be verified.')
  expect(screen.getByRole('alertdialog')).toBeInTheDocument()
  expect(verifyManual).toHaveBeenCalledWith(9)
})

test('does not expose server details for a payment verification server error', async () => {
  const manualOrder: Order = {
    ...order,
    payments: [{ id: 10, provider: 'ayapay', status: 'pending', amount_minor: 172500, currency: 'MMK', provider_payment_id: null, metadata: null }],
  }
  vi.spyOn(adminApi, 'order').mockResolvedValue(manualOrder)
  vi.spyOn(adminApi, 'orders').mockResolvedValue({ data: [manualOrder], meta: { current_page: 1, per_page: 100, last_page: 1, total: 1 } })
  vi.spyOn(adminApi, 'verifyManualPayment').mockRejectedValue({ status: 500, message: 'SQLSTATE[secret-details]' })
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } })

  render(<QueryClientProvider client={queryClient}><LanguageProvider><MemoryRouter initialEntries={['/admin/orders/41']}><Routes><Route path="/admin/orders/:id" element={<OrderDetailsPage />} /></Routes></MemoryRouter></LanguageProvider></QueryClientProvider>)

  expect((await screen.findAllByText('AYAPAY')).length).toBeGreaterThan(0)
  fireEvent.click(screen.getByRole('button', { name: 'Confirm Payment' }))
  fireEvent.click(screen.getAllByRole('button', { name: 'Confirm Payment' })[1])

  const alert = await screen.findByRole('alert')
  expect(alert).toHaveTextContent('payment verification service is temporarily unavailable')
  expect(alert).not.toHaveTextContent('SQLSTATE')
})
