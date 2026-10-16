import '@testing-library/jest-dom/vitest'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { cleanup, fireEvent, render, screen, within } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { afterEach, expect, test, vi } from 'vitest'
import { LanguageProvider } from '../store/language'
import { adminApi } from '../services/adminApi'
import type { ShippingCarrier, ShippingMethod } from '../types/admin'
import { ShippingPage } from './ShippingPage'

function response<T>(data: T[]) {
  return { data, meta: { current_page: 1, per_page: 100, last_page: 1, total: data.length } }
}

function renderShippingPage() {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } })
  return render(<QueryClientProvider client={queryClient}><LanguageProvider><MemoryRouter><ShippingPage /></MemoryRouter></LanguageProvider></QueryClientProvider>)
}

afterEach(() => {
  cleanup()
  vi.restoreAllMocks()
})

test('keeps each saved carrier as a separate row after refetching the list', async () => {
  let carriers: ShippingCarrier[] = [{ id: 1, name: 'Existing Courier', code: 'existing-courier', type: 'external_courier', tracking_url: null, is_active: true, sort_order: 0 }]
  const carrierRequest = vi.spyOn(adminApi, 'carriers').mockImplementation(async () => response(carriers))
  vi.spyOn(adminApi, 'shippingMethods').mockResolvedValue(response([]))
  vi.spyOn(adminApi, 'riders').mockResolvedValue(response([]))
  vi.spyOn(adminApi, 'createCarrier').mockImplementation(async (data) => {
    const payload = data as { name: string; code?: string; tracking_url?: string }
    const created: ShippingCarrier = {
      id: carriers.length + 1,
      name: payload.name,
      code: payload.code ?? payload.name.toLowerCase().replaceAll(' ', '-'),
      type: 'external_courier',
      tracking_url: payload.tracking_url ?? null,
      is_active: true,
      sort_order: 0,
    }
    carriers = [created, ...carriers]
    return created
  })

  renderShippingPage()
  await screen.findByText('Existing Courier')

  const nameInput = screen.getByPlaceholderText('Carrier name')
  fireEvent.change(nameInput, { target: { value: 'First New Courier' } })
  fireEvent.click(screen.getByRole('button', { name: 'Add carrier' }))
  await screen.findByText('First New Courier')
  expect(nameInput).toHaveValue('')

  fireEvent.change(nameInput, { target: { value: 'Second New Courier' } })
  fireEvent.click(screen.getByRole('button', { name: 'Add carrier' }))
  await screen.findByText('Second New Courier')

  const rows = within(screen.getByRole('table', { name: 'Shipping carriers' })).getAllByRole('row')
  expect(rows).toHaveLength(4)
  expect(screen.getByText('Existing Courier')).toBeInTheDocument()
  expect(screen.getByText('First New Courier')).toBeInTheDocument()
  expect(screen.getByText('Second New Courier')).toBeInTheDocument()
  expect(carrierRequest).toHaveBeenCalledTimes(3)
})

test('shows a save error and preserves carrier form values', async () => {
  vi.spyOn(adminApi, 'carriers').mockResolvedValue(response([]))
  vi.spyOn(adminApi, 'shippingMethods').mockResolvedValue(response([]))
  vi.spyOn(adminApi, 'riders').mockResolvedValue(response([]))
  vi.spyOn(adminApi, 'createCarrier').mockRejectedValue(new Error('Carrier code already exists.'))

  renderShippingPage()
  await screen.findByText('No carriers configured. Add the first shipping carrier above.')

  const nameInput = screen.getByPlaceholderText('Carrier name')
  fireEvent.change(nameInput, { target: { value: 'Duplicate Courier' } })
  fireEvent.click(screen.getByRole('button', { name: 'Add carrier' }))

  expect(await screen.findByRole('status')).toHaveTextContent('Carrier code already exists.')
  expect(nameInput).toHaveValue('Duplicate Courier')
})

test('keeps each customer delivery option as a separate row after refetching the list', async () => {
  let methods: ShippingMethod[] = [{ id: 1, code: 'standard', name: 'Standard delivery', description: '3–5 business days', price_minor: 0, currency: 'MMK', is_active: true, sort_order: 1 }]
  const methodRequest = vi.spyOn(adminApi, 'shippingMethods').mockImplementation(async () => response(methods))
  vi.spyOn(adminApi, 'carriers').mockResolvedValue(response([]))
  vi.spyOn(adminApi, 'riders').mockResolvedValue(response([]))
  vi.spyOn(adminApi, 'createShippingMethod').mockImplementation(async (data) => {
    const payload = data as { name: string; code: string; description?: string; price_minor: number; currency: string; sort_order: number }
    const created = { id: methods.length + 1, ...payload, description: payload.description ?? null, is_active: true }
    methods = [created, ...methods]
    return created
  })

  renderShippingPage()
  await screen.findByText('Standard delivery')

  const nameInput = screen.getByPlaceholderText('Delivery name')
  const deliveryForm = nameInput.closest('form') as HTMLElement
  fireEvent.change(nameInput, { target: { value: 'Express delivery' } })
  fireEvent.change(within(deliveryForm).getByPlaceholderText('Code'), { target: { value: 'express' } })
  fireEvent.click(screen.getByRole('button', { name: 'Add delivery' }))
  await screen.findByText('Express delivery')
  expect(nameInput).toHaveValue('')

  fireEvent.change(nameInput, { target: { value: 'Pickup point' } })
  fireEvent.change(within(deliveryForm).getByPlaceholderText('Code'), { target: { value: 'pickup' } })
  fireEvent.click(screen.getByRole('button', { name: 'Add delivery' }))
  await screen.findByText('Pickup point')

  const rows = within(screen.getByRole('table', { name: 'Delivery methods' })).getAllByRole('row')
  expect(rows).toHaveLength(4)
  expect(screen.getByText('Standard delivery')).toBeInTheDocument()
  expect(screen.getByText('Express delivery')).toBeInTheDocument()
  expect(screen.getByText('Pickup point')).toBeInTheDocument()
  expect(methodRequest).toHaveBeenCalledTimes(3)
})

test('updates rider status from Active to Disabled and back through the API', async () => {
  const riders = [{ id: 7, name: 'Aung Rider', phone: '0912345678', status: 'active', seller: null }]
  vi.spyOn(adminApi, 'carriers').mockResolvedValue(response([]))
  vi.spyOn(adminApi, 'shippingMethods').mockResolvedValue(response([]))
  vi.spyOn(adminApi, 'riders').mockImplementation(async () => response(riders))
  const updateRider = vi.spyOn(adminApi, 'updateRider').mockImplementation(async (id, data) => {
    const rider = riders.find((item) => item.id === id)
    if (rider && typeof data === 'object' && data && 'status' in data) rider.status = String(data.status)
    return rider
  })

  renderShippingPage()
  await screen.findByText('Aung Rider')
  expect(screen.getByText('Active')).toBeInTheDocument()

  fireEvent.click(screen.getByRole('button', { name: 'Disable' }))
  await screen.findByRole('button', { name: 'Enable' })
  expect(screen.getByText('Disabled')).toBeInTheDocument()
  expect(updateRider).toHaveBeenNthCalledWith(1, 7, { status: 'inactive' })

  fireEvent.click(screen.getByRole('button', { name: 'Enable' }))
  await screen.findByRole('button', { name: 'Disable' })
  expect(screen.getByText('Active')).toBeInTheDocument()
  expect(updateRider).toHaveBeenNthCalledWith(2, 7, { status: 'active' })
})

test('shows a rider status error without changing the displayed state when the API fails', async () => {
  vi.spyOn(adminApi, 'carriers').mockResolvedValue(response([]))
  vi.spyOn(adminApi, 'shippingMethods').mockResolvedValue(response([]))
  vi.spyOn(adminApi, 'riders').mockResolvedValue(response([{ id: 8, name: 'Failed Update Rider', phone: null, status: 'active', seller: null }]))
  vi.spyOn(adminApi, 'updateRider').mockRejectedValue(new Error('Permission denied.'))

  renderShippingPage()
  await screen.findByText('Failed Update Rider')
  fireEvent.click(screen.getByRole('button', { name: 'Disable' }))

  expect(await screen.findByRole('status')).toHaveTextContent('Permission denied.')
  expect(screen.getByText('Active')).toBeInTheDocument()
  expect(screen.getByRole('button', { name: 'Disable' })).toBeInTheDocument()
})
