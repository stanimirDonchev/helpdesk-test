import { screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import axios from 'axios'
import { beforeEach, expect, test, vi } from 'vitest'
import { renderWithQueryClient } from '../test/render-with-query'
import { UsersTable } from './UsersTable'

vi.mock('axios')

// `DeleteUserDialog` hides itself on the signed-in user's own row, so the table
// reads session state through its children.
const { useSessionMock } = vi.hoisted(() => ({ useSessionMock: vi.fn() }))

vi.mock('../lib/auth-client', () => ({
  authClient: { useSession: useSessionMock },
}))

beforeEach(() => {
  useSessionMock.mockReturnValue({ data: { user: { id: 'signed-in-admin', role: 'admin' } } })
})

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

test('renders a column header for the row actions', async () => {
  vi.mocked(axios.get).mockResolvedValue({ data: { users: mockUsers } })

  renderWithQueryClient(<UsersTable />)
  await screen.findByText('Ada Admin')

  expect(screen.getByRole('columnheader', { name: 'Actions' })).toBeInTheDocument()
})

test('reserves the actions column while loading', () => {
  vi.mocked(axios.get).mockReturnValue(new Promise(() => {}))

  renderWithQueryClient(<UsersTable />)

  expect(screen.getAllByRole('columnheader')).toHaveLength(5)
})

test('renders an edit button for each user', async () => {
  vi.mocked(axios.get).mockResolvedValue({ data: { users: mockUsers } })

  renderWithQueryClient(<UsersTable />)
  await screen.findByText('Ada Admin')

  expect(screen.getByRole('button', { name: 'Edit Ada Admin' })).toBeInTheDocument()
  expect(screen.getByRole('button', { name: 'Edit Gene Agent' })).toBeInTheDocument()
})

test('opens the edit dialog populated with the clicked row', async () => {
  vi.mocked(axios.get).mockResolvedValue({ data: { users: mockUsers } })

  const user = userEvent.setup()
  renderWithQueryClient(<UsersTable />)
  await screen.findByText('Gene Agent')

  await user.click(screen.getByRole('button', { name: 'Edit Gene Agent' }))

  expect(await screen.findByRole('dialog')).toBeInTheDocument()
  expect(screen.getByRole('heading', { name: 'Edit user' })).toBeInTheDocument()
  expect(screen.getByLabelText('Name')).toHaveValue('Gene Agent')
  expect(screen.getByLabelText('Email')).toHaveValue('gene@example.com')
})

test('renders a delete button for each user', async () => {
  vi.mocked(axios.get).mockResolvedValue({ data: { users: mockUsers } })

  renderWithQueryClient(<UsersTable />)
  await screen.findByText('Ada Admin')

  expect(screen.getByRole('button', { name: 'Delete Ada Admin' })).toBeInTheDocument()
  expect(screen.getByRole('button', { name: 'Delete Gene Agent' })).toBeInTheDocument()
})

test('does not offer a delete button on the row of the signed-in user', async () => {
  useSessionMock.mockReturnValue({ data: { user: { id: '1', role: 'admin' } } })
  vi.mocked(axios.get).mockResolvedValue({ data: { users: mockUsers } })

  renderWithQueryClient(<UsersTable />)
  await screen.findByText('Ada Admin')

  // Ada is the signed-in admin, so only her row loses the delete affordance.
  expect(screen.queryByRole('button', { name: 'Delete Ada Admin' })).not.toBeInTheDocument()
  expect(screen.getByRole('button', { name: 'Edit Ada Admin' })).toBeInTheDocument()
  expect(screen.getByRole('button', { name: 'Delete Gene Agent' })).toBeInTheDocument()
})

test('opens the delete confirmation for the clicked row', async () => {
  vi.mocked(axios.get).mockResolvedValue({ data: { users: mockUsers } })

  const user = userEvent.setup()
  renderWithQueryClient(<UsersTable />)
  await screen.findByText('Gene Agent')

  await user.click(screen.getByRole('button', { name: 'Delete Gene Agent' }))

  expect(await screen.findByRole('heading', { name: 'Delete user' })).toBeInTheDocument()
  expect(screen.getByText(/Gene Agent \(gene@example\.com\)/)).toBeInTheDocument()
})
