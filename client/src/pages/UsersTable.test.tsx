import { screen } from '@testing-library/react'
import axios from 'axios'
import { expect, test, vi } from 'vitest'
import { renderWithQueryClient } from '../test/render-with-query'
import { UsersTable } from './UsersTable'

vi.mock('axios')

const mockUsers = [
  { id: '1', name: 'Ada Admin', email: 'ada@example.com', role: 'admin', createdAt: '2024-01-01T00:00:00.000Z' },
  { id: '2', name: 'Gene Agent', email: 'gene@example.com', role: 'agent', createdAt: '2024-02-01T00:00:00.000Z' },
]

test('fetches the user list from /api/users', () => {
  vi.mocked(axios.get).mockReturnValue(new Promise(() => {}))

  renderWithQueryClient(<UsersTable />)

  expect(axios.get).toHaveBeenCalledWith('/api/users')
})

test('shows skeleton rows before the fetch resolves', () => {
  vi.mocked(axios.get).mockReturnValue(new Promise(() => {}))

  const { container } = renderWithQueryClient(<UsersTable />)

  expect(container.querySelectorAll('[data-slot="skeleton"]').length).toBeGreaterThan(0)
})

test('renders the list of users once loaded', async () => {
  vi.mocked(axios.get).mockResolvedValue({ data: { users: mockUsers } })

  renderWithQueryClient(<UsersTable />)

  expect(await screen.findByText('Ada Admin')).toBeInTheDocument()
  expect(screen.getByText('Gene Agent')).toBeInTheDocument()
  expect(screen.getByText('ada@example.com')).toBeInTheDocument()
  expect(screen.getByText('gene@example.com')).toBeInTheDocument()
})

test('renders a column header for each field', async () => {
  vi.mocked(axios.get).mockResolvedValue({ data: { users: mockUsers } })

  renderWithQueryClient(<UsersTable />)

  await screen.findByText('Ada Admin')

  expect(screen.getByRole('columnheader', { name: 'Name' })).toBeInTheDocument()
  expect(screen.getByRole('columnheader', { name: 'Email' })).toBeInTheDocument()
  expect(screen.getByRole('columnheader', { name: 'Role' })).toBeInTheDocument()
  expect(screen.getByRole('columnheader', { name: 'Joined' })).toBeInTheDocument()
})

test('renders each user\'s role and formatted join date', async () => {
  vi.mocked(axios.get).mockResolvedValue({ data: { users: mockUsers } })

  renderWithQueryClient(<UsersTable />)

  await screen.findByText('Ada Admin')

  expect(screen.getByText('admin')).toBeInTheDocument()
  expect(screen.getByText('agent')).toBeInTheDocument()
  expect(screen.getByText(new Date('2024-01-01T00:00:00.000Z').toLocaleDateString())).toBeInTheDocument()
  expect(screen.getByText(new Date('2024-02-01T00:00:00.000Z').toLocaleDateString())).toBeInTheDocument()
})

test('shows an empty state when there are no users', async () => {
  vi.mocked(axios.get).mockResolvedValue({ data: { users: [] } })

  renderWithQueryClient(<UsersTable />)

  expect(await screen.findByText('No users found.')).toBeInTheDocument()
  expect(screen.queryByRole('table')).not.toBeInTheDocument()
})

test('shows an error state when the fetch fails', async () => {
  vi.mocked(axios.get).mockRejectedValue(new Error('network error'))

  renderWithQueryClient(<UsersTable />)

  expect(await screen.findByText('Failed to load users.')).toBeInTheDocument()
})
