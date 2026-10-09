import { screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import axios from 'axios'
import { beforeEach, expect, test, vi } from 'vitest'
import { renderWithQueryClient } from '../test/render-with-query'
import { DeleteUserDialog } from './DeleteUserDialog'

vi.mock('axios')

const { useSessionMock } = vi.hoisted(() => ({ useSessionMock: vi.fn() }))

vi.mock('../lib/auth-client', () => ({
  authClient: { useSession: useSessionMock },
}))

const mockUser = {
  id: '2',
  name: 'Gene Agent',
  email: 'gene@example.com',
  role: 'agent',
  createdAt: '2024-02-01T00:00:00.000Z',
} as const

// The signed-in admin is someone other than the user being deleted.
beforeEach(() => {
  useSessionMock.mockReturnValue({ data: { user: { id: '1', role: 'admin' } } })
})

async function openDialog() {
  const user = userEvent.setup()
  renderWithQueryClient(<DeleteUserDialog user={mockUser} />)

  await user.click(screen.getByRole('button', { name: 'Delete Gene Agent' }))

  return user
}

test('renders a delete button for the user', () => {
  renderWithQueryClient(<DeleteUserDialog user={mockUser} />)

  expect(screen.getByRole('button', { name: 'Delete Gene Agent' })).toBeInTheDocument()
})

test('renders nothing for your own account', () => {
  useSessionMock.mockReturnValue({ data: { user: { id: mockUser.id, role: 'admin' } } })

  renderWithQueryClient(<DeleteUserDialog user={mockUser} />)

  expect(screen.queryByRole('button', { name: 'Delete Gene Agent' })).not.toBeInTheDocument()
})

test('asks for confirmation before deleting anything', async () => {
  await openDialog()

  expect(screen.getByRole('heading', { name: 'Delete user' })).toBeInTheDocument()
  expect(screen.getByText(/Gene Agent \(gene@example\.com\)/)).toBeInTheDocument()
  expect(axios.delete).not.toHaveBeenCalled()
})

test('does not show the confirmation until the button is clicked', () => {
  renderWithQueryClient(<DeleteUserDialog user={mockUser} />)

  expect(screen.queryByRole('heading', { name: 'Delete user' })).not.toBeInTheDocument()
})

test('does not delete when the confirmation is cancelled', async () => {
  const user = await openDialog()

  await user.click(screen.getByRole('button', { name: 'Cancel' }))

  await vi.waitFor(() =>
    expect(screen.queryByRole('heading', { name: 'Delete user' })).not.toBeInTheDocument(),
  )
  expect(axios.delete).not.toHaveBeenCalled()
})

test('deletes the user once confirmed', async () => {
  vi.mocked(axios.delete).mockResolvedValue({ data: { user: mockUser } })

  const user = await openDialog()

  await user.click(screen.getByRole('button', { name: 'Delete user' }))

  expect(axios.delete).toHaveBeenCalledWith('/api/users/2')
})

test('closes the confirmation on success', async () => {
  vi.mocked(axios.delete).mockResolvedValue({ data: { user: mockUser } })

  const user = await openDialog()

  await user.click(screen.getByRole('button', { name: 'Delete user' }))

  await vi.waitFor(() =>
    expect(screen.queryByRole('heading', { name: 'Delete user' })).not.toBeInTheDocument(),
  )
})

test('disables the confirm button while the request is in flight', async () => {
  vi.mocked(axios.delete).mockReturnValue(new Promise(() => {}))

  const user = await openDialog()

  await user.click(screen.getByRole('button', { name: 'Delete user' }))

  expect(await screen.findByRole('button', { name: 'Deleting…' })).toBeDisabled()
})

test('shows a server error and keeps the confirmation open when deletion fails', async () => {
  vi.mocked(axios.isAxiosError).mockReturnValue(true)
  vi.mocked(axios.delete).mockRejectedValue({
    response: { data: { error: 'You cannot delete your own account' } },
  })

  const user = await openDialog()

  await user.click(screen.getByRole('button', { name: 'Delete user' }))

  expect(await screen.findByText('You cannot delete your own account')).toBeInTheDocument()
  expect(screen.getByRole('heading', { name: 'Delete user' })).toBeInTheDocument()
})

test('falls back to a generic message when the failure carries no error text', async () => {
  vi.mocked(axios.delete).mockRejectedValue(new Error('Network Error'))

  const user = await openDialog()

  await user.click(screen.getByRole('button', { name: 'Delete user' }))

  expect(await screen.findByText('Failed to delete user')).toBeInTheDocument()
})

test('clears the server error when the confirmation is reopened', async () => {
  vi.mocked(axios.delete).mockRejectedValue(new Error('Network Error'))

  const user = await openDialog()

  await user.click(screen.getByRole('button', { name: 'Delete user' }))
  expect(await screen.findByText('Failed to delete user')).toBeInTheDocument()

  await user.click(screen.getByRole('button', { name: 'Cancel' }))
  await vi.waitFor(() =>
    expect(screen.queryByRole('heading', { name: 'Delete user' })).not.toBeInTheDocument(),
  )

  await user.click(screen.getByRole('button', { name: 'Delete Gene Agent' }))
  expect(screen.queryByText('Failed to delete user')).not.toBeInTheDocument()
})
