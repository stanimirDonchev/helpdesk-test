import { screen } from '@testing-library/react'
import axios from 'axios'
import { expect, test, vi } from 'vitest'
import { renderWithQueryClient } from '../test/render-with-query'
import { UsersPage } from './UsersPage'

vi.mock('axios')

const mockUsers = [
  { id: '1', name: 'Ada Admin', email: 'ada@example.com', role: 'admin', createdAt: '2024-01-01T00:00:00.000Z' },
  { id: '2', name: 'Gene Agent', email: 'gene@example.com', role: 'agent', createdAt: '2024-02-01T00:00:00.000Z' },
]

test('renders the list of users once loaded', async () => {
  vi.mocked(axios.get).mockResolvedValue({ data: { users: mockUsers } })

  renderWithQueryClient(<UsersPage />)

  expect(await screen.findByText('Ada Admin')).toBeInTheDocument()
  expect(screen.getByText('Gene Agent')).toBeInTheDocument()
  expect(screen.getByText('ada@example.com')).toBeInTheDocument()
})

test('shows skeleton rows before the fetch resolves', () => {
  vi.mocked(axios.get).mockReturnValue(new Promise(() => {}))

  const { container } = renderWithQueryClient(<UsersPage />)

  expect(container.querySelectorAll('[data-slot="skeleton"]').length).toBeGreaterThan(0)
})

test('shows an error state when the fetch fails', async () => {
  vi.mocked(axios.get).mockRejectedValue(new Error('network error'))

  renderWithQueryClient(<UsersPage />)

  expect(await screen.findByText('Failed to load users.')).toBeInTheDocument()
})
