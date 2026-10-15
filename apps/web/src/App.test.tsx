import '@testing-library/jest-dom/vitest'
import { render, screen } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { expect, test } from 'vitest'
import { App } from './App'

test('renders the customer home page', () => {
  render(<QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { enabled: false } } })}><App /></QueryClientProvider>)
  expect(screen.getByText(/Good things for/)).toBeInTheDocument()
})
