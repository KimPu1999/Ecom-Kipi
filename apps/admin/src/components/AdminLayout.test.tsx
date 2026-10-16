import '@testing-library/jest-dom/vitest'
import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { afterEach, beforeEach, expect, test, vi } from 'vitest'
import { api } from '../lib/api'
import { useAdminAuth } from '../store/auth'
import { LanguageProvider } from '../store/language'
import { AdminLayout } from './AdminLayout'

beforeEach(() => {
  useAdminAuth.getState().setSession({ id: 1, name: 'Platform Admin', email: 'admin@example.com', phone: null, status: 'active', roles: ['super_admin'] }, 'test-token')
})

afterEach(() => {
  useAdminAuth.getState().clear()
  vi.restoreAllMocks()
})

test('opens the profile menu and logs out through the existing API', async () => {
  const logout = vi.spyOn(api.auth, 'logout').mockResolvedValue()

  render(<LanguageProvider><MemoryRouter initialEntries={['/admin']}><Routes><Route element={<AdminLayout />}><Route path="/admin" element={<span>Dashboard content</span>} /><Route path="/admin/settings" element={<span>Settings content</span>} /></Route><Route path="/admin/login" element={<span>Login page</span>} /></Routes></MemoryRouter></LanguageProvider>)

  fireEvent.click(screen.getByRole('button', { name: 'Open profile menu' }))
  expect(screen.getByRole('menuitem', { name: 'Settings' })).toHaveAttribute('href', '/admin/settings')

  fireEvent.click(screen.getByRole('menuitem', { name: 'Log out' }))
  await waitFor(() => expect(logout).toHaveBeenCalledTimes(1))
  expect(await screen.findByText('Login page')).toBeInTheDocument()
})

test('shows a Back button on a direct admin page and safely falls back to the dashboard', async () => {
  render(<LanguageProvider><MemoryRouter initialEntries={['/admin/orders']}><Routes><Route element={<AdminLayout />}><Route path="/admin" element={<span>Dashboard content</span>} /><Route path="/admin/orders" element={<span>Orders content</span>} /></Route></Routes></MemoryRouter></LanguageProvider>)

  expect(screen.getByText('Orders content')).toBeInTheDocument()
  fireEvent.click(screen.getByRole('button', { name: 'Back' }))
  expect(await screen.findByText('Dashboard content')).toBeInTheDocument()
})

test('does not show a redundant Back button on a direct dashboard entry', () => {
  render(<LanguageProvider><MemoryRouter initialEntries={['/admin']}><Routes><Route element={<AdminLayout />}><Route path="/admin" element={<span>Dashboard content</span>} /></Route></Routes></MemoryRouter></LanguageProvider>)

  expect(screen.queryByRole('button', { name: 'Back' })).not.toBeInTheDocument()
})
