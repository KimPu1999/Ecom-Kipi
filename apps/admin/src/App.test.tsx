import '@testing-library/jest-dom/vitest'
import { render, screen } from '@testing-library/react'
import { expect, test } from 'vitest'
import { App } from './App'

test('redirects the admin root to login when signed out', () => {
  render(<App />)
  expect(screen.getByRole('heading', { name: 'Welcome Back' })).toBeInTheDocument()
})
