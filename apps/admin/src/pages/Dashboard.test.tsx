import '@testing-library/jest-dom/vitest'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { MemoryRouter, Route, Routes, useLocation, useNavigate } from 'react-router-dom'
import { afterEach, beforeEach, expect, test, vi } from 'vitest'
import { LanguageProvider } from '../store/language'
import { adminApi } from '../services/adminApi'
import type { DashboardData } from '../types/admin'
import { Dashboard } from './Dashboard'

const dashboardData: DashboardData = {
  range: { from: '2026-10-01', to: '2026-10-16' },
  metrics: { customers: 12, products: 8, orders: 24, paid_revenue: 150000, pending_orders: 3, low_stock_products: 0 },
  sales_trend: [],
  status_distribution: [],
  top_products: [],
  recent_orders: [],
  latest_customers: [],
  low_stock: [],
  recent_activity: [],
}

function RouteTarget() {
  const location = useLocation()
  const navigate = useNavigate()
  return <div><span>{location.pathname}</span><button onClick={() => navigate(-1)}>Back</button></div>
}

beforeEach(() => {
  vi.stubGlobal('ResizeObserver', class {
    observe() {}
    unobserve() {}
    disconnect() {}
  })
})

afterEach(() => {
  vi.unstubAllGlobals()
  vi.restoreAllMocks()
})

test('dashboard stat and summary cards navigate to their existing admin pages', async () => {
  const dashboardRequest = vi.spyOn(adminApi, 'dashboard').mockResolvedValue(dashboardData)
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } })

  render(<QueryClientProvider client={queryClient}><LanguageProvider><MemoryRouter initialEntries={['/admin']}><Routes><Route path="/admin" element={<Dashboard />} /><Route path="*" element={<RouteTarget />} /></Routes></MemoryRouter></LanguageProvider></QueryClientProvider>)

  const destinations = [
    ['Customers', '/admin/users'],
    ['Products', '/admin/products'],
    ['Orders', '/admin/orders'],
    ['Paid revenue', '/admin/reports'],
    ['Recent orders', '/admin/orders'],
    ['Low stock alerts', '/admin/inventory'],
  ] as const

  for (const [label, destination] of destinations) {
    fireEvent.click(await screen.findByRole('link', { name: new RegExp(label) }))
    expect(await screen.findByText(destination)).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: 'Back' }))
    expect(await screen.findByRole('link', { name: new RegExp(label) })).toBeInTheDocument()
  }

  const rangeSelector = screen.getByRole('combobox', { name: 'Dashboard date range' })
  for (const range of ['7d', '30d', '90d']) {
    fireEvent.change(rangeSelector, { target: { value: range } })
    await waitFor(() => expect(dashboardRequest).toHaveBeenCalledWith(range))
  }
})
