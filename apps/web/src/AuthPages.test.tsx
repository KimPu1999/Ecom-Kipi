import '@testing-library/jest-dom/vitest'
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { afterEach, describe, expect, it } from 'vitest'
import { Login, Register } from './pages/AuthPages'

afterEach(cleanup)

describe('THANGPC authentication pages', () => {
  it('renders the login experience and toggles password visibility', () => {
    render(<MemoryRouter initialEntries={['/login']}><Login /></MemoryRouter>)

    expect(screen.getByRole('heading', { name: 'Welcome Back' })).toBeInTheDocument()
    expect(screen.getByText('Sign in to explore the latest PC hardware and electronics.')).toBeInTheDocument()
    expect(screen.getByRole('link', { name: 'THANGPC home' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Continue with Google' })).toBeDisabled()

    const password = screen.getByPlaceholderText('Enter your password')
    expect(password).toHaveAttribute('type', 'password')
    fireEvent.click(screen.getByRole('button', { name: 'Show password' }))
    expect(password).toHaveAttribute('type', 'text')
  })

  it('renders registration fields and surfaces schema validation without calling the API', async () => {
    render(<MemoryRouter initialEntries={['/register']}><Register /></MemoryRouter>)

    expect(screen.getByRole('heading', { name: 'Create Your THANGPC Account' })).toBeInTheDocument()
    expect(screen.getByLabelText('Full name')).toBeInTheDocument()
    expect(screen.getByLabelText('Email address')).toBeInTheDocument()
    expect(screen.getByLabelText('Phone (optional)')).toBeInTheDocument()
    expect(screen.getByLabelText('Password')).toBeInTheDocument()
    expect(screen.getByLabelText('Confirm password')).toBeInTheDocument()

    fireEvent.click(screen.getByRole('button', { name: 'Create Account' }))
    await waitFor(() => expect(screen.getByText('Name must be at least 2 characters.')).toBeInTheDocument())
    expect(screen.getByText('Enter a valid email address.')).toBeInTheDocument()
    expect(screen.getAllByText('Password must be at least 8 characters.')).toHaveLength(1)
  })
})
