import { screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import axios from 'axios'
import { expect, test, vi } from 'vitest'
import { renderWithQueryClient } from '../test/render-with-query'
import { CreateUserDialog } from './CreateUserDialog'

vi.mock('axios')

async function openDialog() {
  const user = userEvent.setup()
  renderWithQueryClient(<CreateUserDialog />)

  await user.click(screen.getByRole('button', { name: 'Create user' }))

  return user
}

test('the modal is closed by default', () => {
  renderWithQueryClient(<CreateUserDialog />)

  expect(screen.queryByLabelText('Name')).not.toBeInTheDocument()
})

test('opens the modal with name, email, and password fields', async () => {
  await openDialog()

  expect(screen.getByLabelText('Name')).toBeInTheDocument()
  expect(screen.getByLabelText('Email')).toBeInTheDocument()
  expect(screen.getByLabelText('Password')).toBeInTheDocument()
})

test('shows a validation error and does not submit when the name is too short', async () => {
  const user = await openDialog()

  await user.type(screen.getByLabelText('Name'), 'Al')
  await user.type(screen.getByLabelText('Email'), 'al@example.com')
  await user.type(screen.getByLabelText('Password'), 'password123')
  await user.click(screen.getByRole('button', { name: 'Create user' }))

  expect(await screen.findByText('Name must be at least 3 characters')).toBeInTheDocument()
  expect(axios.post).not.toHaveBeenCalled()
})

test('shows a validation error and does not submit when the password is too short', async () => {
  const user = await openDialog()

  await user.type(screen.getByLabelText('Name'), 'Alice')
  await user.type(screen.getByLabelText('Email'), 'alice@example.com')
  await user.type(screen.getByLabelText('Password'), 'short')
  await user.click(screen.getByRole('button', { name: 'Create user' }))

  expect(await screen.findByText('Password must be at least 8 characters')).toBeInTheDocument()
  expect(axios.post).not.toHaveBeenCalled()
})

test('shows a validation error when the email is invalid', async () => {
  const user = await openDialog()

  await user.type(screen.getByLabelText('Name'), 'Alice')
  await user.type(screen.getByLabelText('Email'), 'not-an-email')
  await user.type(screen.getByLabelText('Password'), 'password123')
  await user.click(screen.getByRole('button', { name: 'Create user' }))

  expect(await screen.findByText('Enter a valid email address')).toBeInTheDocument()
  expect(axios.post).not.toHaveBeenCalled()
})

test('creates the user, closes the modal, and resets the form on success', async () => {
  vi.mocked(axios.post).mockResolvedValue({
    data: { user: { id: '1', name: 'Alice', email: 'alice@example.com', role: 'agent', createdAt: '2024-01-01T00:00:00.000Z' } },
  })

  const user = await openDialog()

  await user.type(screen.getByLabelText('Name'), 'Alice')
  await user.type(screen.getByLabelText('Email'), 'alice@example.com')
  await user.type(screen.getByLabelText('Password'), 'password123')
  await user.click(screen.getByRole('button', { name: 'Create user' }))

  expect(axios.post).toHaveBeenCalledWith('/api/users', {
    name: 'Alice',
    email: 'alice@example.com',
    password: 'password123',
  })

  await vi.waitFor(() => expect(screen.queryByLabelText('Name')).not.toBeInTheDocument())

  await user.click(screen.getByRole('button', { name: 'Create user' }))
  expect(screen.getByLabelText('Name')).toHaveValue('')
})

test('shows a server error and keeps the modal open when creation fails', async () => {
  vi.mocked(axios.isAxiosError).mockReturnValue(true)
  vi.mocked(axios.post).mockRejectedValue({
    response: { data: { error: 'A user with this email already exists' } },
  })

  const user = await openDialog()

  await user.type(screen.getByLabelText('Name'), 'Alice')
  await user.type(screen.getByLabelText('Email'), 'alice@example.com')
  await user.type(screen.getByLabelText('Password'), 'password123')
  await user.click(screen.getByRole('button', { name: 'Create user' }))

  expect(await screen.findByText('A user with this email already exists')).toBeInTheDocument()
  expect(screen.getByLabelText('Name')).toBeInTheDocument()
})
