import '@testing-library/jest-dom/vitest'
import { fireEvent, render, screen } from '@testing-library/react'
import { useState } from 'react'
import { expect, test } from 'vitest'
import { LanguageProvider } from '../store/language'
import { SearchBox } from './ui'

function SearchHarness() {
  const [value, setValue] = useState('initial')
  return <SearchBox value={value} onChange={setValue} placeholder="Search products" />
}

test('keeps the shared search input editable while typing and clearing', () => {
  render(<LanguageProvider><SearchHarness /></LanguageProvider>)

  const input = screen.getByRole('textbox', { name: 'Search products' })
  expect(input).toHaveValue('initial')
  expect(input).not.toBeDisabled()
  expect(input).not.toHaveAttribute('readonly')

  fireEvent.change(input, { target: { value: 'initial x' } })
  expect(input).toHaveValue('initial x')

  fireEvent.change(input, { target: { value: 'initial' } })
  expect(input).toHaveValue('initial')

  fireEvent.change(input, { target: { value: '' } })
  expect(input).toHaveValue('')

  fireEvent.change(input, { target: { value: 'replacement' } })
  expect(input).toHaveValue('replacement')

  const clearButton = screen.getByRole('button', { name: 'Clear search' })
  fireEvent.click(clearButton)
  expect(input).toHaveValue('')
  expect(screen.queryByRole('button', { name: 'Clear search' })).not.toBeInTheDocument()
  expect(document.activeElement).toBe(input)
})
