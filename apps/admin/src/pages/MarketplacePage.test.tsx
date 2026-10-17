import '@testing-library/jest-dom/vitest'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { afterEach, expect, test, vi } from 'vitest'
import { api } from '../lib/api'
import { MarketplacePage } from './MarketplacePage'

const application = {
  id: 9,
  business_name: 'Golden Lotus Trading',
  business_type: 'Retail',
  business_details: { address: 'Yangon', category: 'Home goods' },
  contact_details: { phone: '09990000000' },
  application_status: 'pending',
  submitted_at: '2026-10-16T08:00:00.000Z',
  documents: [{ id: 31, document_type: 'business_license', status: 'submitted' }],
  user: { name: 'Aye Aye', email: 'aye@example.com' },
  approval_history: [],
}

function renderPage() {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } })
  return render(<QueryClientProvider client={client}><MemoryRouter><MarketplacePage /></MemoryRouter></QueryClientProvider>)
}

afterEach(() => {
  cleanup()
  vi.restoreAllMocks()
})

test('Review loads the selected seller application from the detail endpoint', async () => {
  const request = vi.spyOn(api, 'request').mockImplementation(async (config) => {
    if (config.url === '/admin/marketplace/applications/9') return { data: { data: application } } as never
    return { data: { data: { data: [application], meta: { total: 1 } } } } as never
  })

  renderPage()
  fireEvent.click(await screen.findByRole('button', { name: 'Review seller application 9' }))

  const dialog = await screen.findByRole('dialog', { name: 'Golden Lotus Trading' })
  expect(dialog).toBeInTheDocument()
  expect(within(dialog).getByText('Aye Aye')).toBeInTheDocument()
  expect(within(dialog).getByText('Business License')).toBeInTheDocument()
  expect(within(dialog).getByText('Application #9')).toBeInTheDocument()
  expect(request).toHaveBeenCalledWith({ url: '/admin/marketplace/applications/9' })

  fireEvent.click(screen.getByRole('button', { name: 'Close seller application review' }))
  expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
})

test('Review displays a detail API error without hiding the approvals list', async () => {
  vi.spyOn(api, 'request').mockImplementation(async (config) => {
    if (config.url === '/admin/marketplace/applications/9') throw new Error('Permission denied.')
    return { data: { data: { data: [application], meta: { total: 1 } } } } as never
  })

  renderPage()
  fireEvent.click(await screen.findByRole('button', { name: 'Review seller application 9' }))

  expect(await screen.findByText('Permission denied.')).toBeInTheDocument()
  expect(screen.getByRole('button', { name: 'Review seller application 9' })).toBeInTheDocument()
})

test('Approve submits the controlled confirmation payload and shows success after the API confirms it', async () => {
  const request = vi.spyOn(api, 'request').mockImplementation(async (config) => {
    if (config.url === '/admin/marketplace/applications/9') return { data: { data: application } } as never
    if (config.url === '/admin/marketplace/applications/9/approve') return { data: { data: { id: 4, status: 'approved' } } } as never
    return { data: { data: { data: [application], meta: { total: 1 } } } } as never
  })

  renderPage()
  fireEvent.click(await screen.findByRole('button', { name: 'Review seller application 9' }))
  const dialog = await screen.findByRole('dialog', { name: 'Golden Lotus Trading' })
  fireEvent.click(within(dialog).getByRole('button', { name: 'Approve' }))
  fireEvent.click(within(dialog).getByRole('button', { name: 'Confirm approval' }))

  await waitFor(() => expect(request).toHaveBeenCalledWith({
    url: '/admin/marketplace/applications/9/approve',
    method: 'POST',
    data: { store_name: 'Golden Lotus Trading', slug: 'golden-lotus-trading' },
  }))
  expect(await screen.findByText('Seller application approved.')).toBeInTheDocument()
})

test('Reject requires a reason and submits it to the existing API', async () => {
  const request = vi.spyOn(api, 'request').mockImplementation(async (config) => {
    if (config.url === '/admin/marketplace/applications/9') return { data: { data: application } } as never
    if (config.url === '/admin/marketplace/applications/9/reject') return { data: { data: { ...application, application_status: 'rejected' } } } as never
    return { data: { data: { data: [application], meta: { total: 1 } } } } as never
  })

  renderPage()
  fireEvent.click(await screen.findByRole('button', { name: 'Review seller application 9' }))
  const dialog = await screen.findByRole('dialog', { name: 'Golden Lotus Trading' })
  fireEvent.click(within(dialog).getByRole('button', { name: 'Reject' }))
  fireEvent.change(within(dialog).getByLabelText('Rejection reason'), { target: { value: 'Missing required license.' } })
  fireEvent.click(within(dialog).getByRole('button', { name: 'Confirm rejection' }))

  await waitFor(() => expect(request).toHaveBeenCalledWith({
    url: '/admin/marketplace/applications/9/reject',
    method: 'POST',
    data: { rejection_reason: 'Missing required license.' },
  }))
})
