import { afterEach, describe, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { api } from './lib/api'
import { Payouts } from './App'

afterEach(() => {
  cleanup()
  vi.restoreAllMocks()
})

const earnings = {
  total_sales_minor: 1000,
  commission_deducted_minor: 50,
  commission_refunds_minor: 0,
  net_earnings_minor: 950,
  pending_earnings_minor: 950,
  paid_earnings_minor: 0,
  refund_adjustments_minor: 0,
  gross_minor: 1000,
  available_minor: 950,
  available_balance_minor: 950,
  total_earnings_minor: 950,
  pending_payout_requests: 0,
  pending_payout_amount_minor: 0,
  processing_payouts: 0,
  processing_payout_amount_minor: 0,
  total_paid_out_minor: 0,
  payout_min_minor: 1,
  payout_max_minor: 0,
  currency: 'MMK',
  payout_processing_configured: false,
  commission_history: [],
}

function renderPayouts() {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  return render(<QueryClientProvider client={queryClient}><Payouts /></QueryClientProvider>)
}

describe('Seller payouts', () => {
  it('shows empty payout methods and history without inventing records', async () => {
    const request = vi.spyOn(api, 'request').mockImplementation(async (config) => {
      if (config.url === '/seller/earnings') return { data: { data: earnings } } as never
      if (config.url === '/seller/payouts') return { data: { data: [] } } as never
      return { data: { data: [] } } as never
    })

    renderPayouts()

    expect(await screen.findByText('No payout methods have been added.')).not.toBeNull()
    expect(screen.getByText('No payout requests yet.')).not.toBeNull()
    expect(request).toHaveBeenCalled()
  })

  it('submits a payout with the selected method and an idempotency key', async () => {
    const method = { id: 7, method: 'kbzpay', provider_name: 'KBZPay', account_holder_name: 'Seller', account_last4: '0123', masked_identifier: '••••0123', verification_status: 'verified', verified_at: null, is_default: true, is_active: true }
    const request = vi.spyOn(api, 'request').mockImplementation(async (config) => {
      if (config.url === '/seller/earnings') return { data: { data: earnings } } as never
      if (config.url === '/seller/payout-methods') return { data: { data: [method] } } as never
      if (config.url === '/seller/payouts' && config.method === 'POST') return { data: { data: { id: 11 } } } as never
      return { data: { data: [] } } as never
    })
    vi.spyOn(window, 'confirm').mockReturnValue(true)

    renderPayouts()
    fireEvent.change(await screen.findByLabelText('Amount (MMK)'), { target: { value: '500' } })
    fireEvent.change(screen.getByLabelText('Payout method'), { target: { value: '7' } })
    fireEvent.click(screen.getByRole('button', { name: 'Request payout' }))

    await waitFor(() => expect(request).toHaveBeenCalledWith(expect.objectContaining({ url: '/seller/payouts', method: 'POST', data: { amount_minor: 500, payout_method_id: 7 }, headers: expect.objectContaining({ 'Idempotency-Key': expect.any(String) }) })))
  })
})
