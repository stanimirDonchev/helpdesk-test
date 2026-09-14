import { render, screen } from '@testing-library/react'
import { afterEach, beforeEach, expect, test, vi } from 'vitest'
import App from './App'

beforeEach(() => {
  vi.stubGlobal(
    'fetch',
    vi.fn(() =>
      Promise.resolve({
        json: () => Promise.resolve({ status: 'ok' }),
      }),
    ),
  )
})

afterEach(() => {
  vi.unstubAllGlobals()
})

test('renders the heading and the API status once loaded', async () => {
  render(<App />)

  expect(screen.getByRole('heading', { name: 'Helpdesk' })).toBeInTheDocument()
  expect(await screen.findByText('API status: ok')).toBeInTheDocument()
})
