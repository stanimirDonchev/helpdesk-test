import { render, screen } from '@testing-library/react'
import { afterEach, expect, test, vi } from 'vitest'
import { UsersPage } from './UsersPage'

const mockUsers = [
  { id: '1', name: 'Ada Admin', email: 'ada@example.com', role: 'admin', createdAt: '2024-01-01T00:00:00.000Z' },
  { id: '2', name: 'Gene Agent', email: 'gene@example.com', role: 'agent', createdAt: '2024-02-01T00:00:00.000Z' },
]

afterEach(() => {
  vi.unstubAllGlobals()
})

test('renders the list of users once loaded', async () => {
  vi.stubGlobal(
    'fetch',
    vi.fn(() =>
      Promise.resolve({
        ok: true,
        json: () => Promise.resolve({ users: mockUsers }),
      }),
    ),
  )

  render(<UsersPage />)

  expect(await screen.findByText('Ada Admin')).toBeInTheDocument()
  expect(screen.getByText('Gene Agent')).toBeInTheDocument()
  expect(screen.getByText('ada@example.com')).toBeInTheDocument()
})

test('shows a loading state before the fetch resolves', () => {
  vi.stubGlobal(
    'fetch',
    vi.fn(() => new Promise(() => {})),
  )

  render(<UsersPage />)

  expect(screen.getByText('Loading users…')).toBeInTheDocument()
})

test('shows an error state when the fetch fails', async () => {
  vi.stubGlobal(
    'fetch',
    vi.fn(() => Promise.reject(new Error('network error'))),
  )

  render(<UsersPage />)

  expect(await screen.findByText('Failed to load users.')).toBeInTheDocument()
})
