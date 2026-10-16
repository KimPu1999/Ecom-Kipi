import { afterEach, describe, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { SellerProfileMenu } from './App'

afterEach(() => cleanup())

function renderProfileMenu(onLogout = vi.fn<() => Promise<void>>().mockResolvedValue(undefined)) {
  render(
    <MemoryRouter>
      <SellerProfileMenu user={{ name: 'Aye Aye', email: 'seller@example.com' }} onLogout={onLogout} />
    </MemoryRouter>,
  )
  return onLogout
}

describe('SellerProfileMenu', () => {
  it('shows the authenticated seller details and existing settings route', () => {
    renderProfileMenu()

    fireEvent.click(screen.getByRole('button', { name: 'Open profile menu' }))

    expect(screen.getByText('seller@example.com')).not.toBeNull()
    expect(screen.getByRole('menuitem', { name: 'Settings' }).getAttribute('href')).toBe('/seller/settings')
    expect(screen.getByRole('menuitem', { name: 'Log out' })).not.toBeNull()
  })

  it('closes on Escape and outside click', () => {
    renderProfileMenu()
    fireEvent.click(screen.getByRole('button', { name: 'Open profile menu' }))
    expect(screen.getByRole('menu')).not.toBeNull()

    fireEvent.keyDown(document, { key: 'Escape' })
    expect(screen.queryByRole('menu')).toBeNull()

    fireEvent.click(screen.getByRole('button', { name: 'Open profile menu' }))
    fireEvent.mouseDown(document.body)
    expect(screen.queryByRole('menu')).toBeNull()
  })

  it('uses the real logout callback once and reports failures', async () => {
    const onLogout = renderProfileMenu(vi.fn<() => Promise<void>>().mockRejectedValue(new Error('Logout failed')))
    fireEvent.click(screen.getByRole('button', { name: 'Open profile menu' }))
    const logout = screen.getByRole('menuitem', { name: 'Log out' })
    fireEvent.click(logout)
    fireEvent.click(logout)

    await waitFor(() => expect(onLogout).toHaveBeenCalledOnce())
    expect((await screen.findByRole('alert')).textContent).toContain('Logout failed')
  })
})
