import { screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import axios from 'axios'
import { useState } from 'react'
import { expect, test, vi } from 'vitest'
import { renderWithQueryClient } from '../test/render-with-query'
import { EditUserDialog } from './EditUserDialog'

vi.mock('axios')

const mockUser = {
  id: '1',
  name: 'Ada Admin',
  email: 'ada@example.com',
  role: 'admin',
  createdAt: '2024-01-01T00:00:00.000Z',
} as const

const updatedUser = { data: { user: mockUser } }

async function openDialog() {
  const user = userEvent.setup()
  renderWithQueryClient(<EditUserDialog user={mockUser} />)

  await user.click(screen.getByRole('button', { name: 'Edit Ada Admin' }))

  return user
}

test('the dialog is closed by default', () => {
  renderWithQueryClient(<EditUserDialog user={mockUser} />)

  expect(screen.queryByLabelText('Name')).not.toBeInTheDocument()
})

test("opens populated with the user's data", async () => {
  await openDialog()

  expect(screen.getByLabelText('Name')).toHaveValue('Ada Admin')
  expect(screen.getByLabelText('Email')).toHaveValue('ada@example.com')
  expect(screen.getByLabelText('Password')).toHaveValue('')
})

test('explains that a blank password keeps the current one', async () => {
  await openDialog()

  expect(screen.getByText('Leave blank to keep the current password')).toBeInTheDocument()
})

test('omits the password from the request when it is left blank', async () => {
  vi.mocked(axios.patch).mockResolvedValue(updatedUser)

  const user = await openDialog()

  await user.click(screen.getByRole('button', { name: 'Save changes' }))

  expect(axios.patch).toHaveBeenCalledWith('/api/users/1', {
    name: 'Ada Admin',
    email: 'ada@example.com',
  })
})

test('sends the new password when one is provided', async () => {
  vi.mocked(axios.patch).mockResolvedValue(updatedUser)

  const user = await openDialog()

  await user.type(screen.getByLabelText('Password'), 'newpassword123')
  await user.click(screen.getByRole('button', { name: 'Save changes' }))

  expect(axios.patch).toHaveBeenCalledWith('/api/users/1', {
    name: 'Ada Admin',
    email: 'ada@example.com',
    password: 'newpassword123',
  })
})

test('rejects a password too short to be a real change', async () => {
  const user = await openDialog()

  await user.type(screen.getByLabelText('Password'), 'short')
  await user.click(screen.getByRole('button', { name: 'Save changes' }))

  expect(await screen.findByText('Password must be at least 8 characters')).toBeInTheDocument()
  expect(axios.patch).not.toHaveBeenCalled()
})

test('shows a validation error when the name is too short', async () => {
  const user = await openDialog()

  await user.clear(screen.getByLabelText('Name'))
  await user.type(screen.getByLabelText('Name'), 'Al')
  await user.click(screen.getByRole('button', { name: 'Save changes' }))

  expect(await screen.findByText('Name must be at least 3 characters')).toBeInTheDocument()
  expect(axios.patch).not.toHaveBeenCalled()
})

test('shows a validation error when the email is invalid', async () => {
  const user = await openDialog()

  await user.clear(screen.getByLabelText('Email'))
  await user.type(screen.getByLabelText('Email'), 'not-an-email')
  await user.click(screen.getByRole('button', { name: 'Save changes' }))

  expect(await screen.findByText('Enter a valid email address')).toBeInTheDocument()
  expect(axios.patch).not.toHaveBeenCalled()
})

test('marks an invalid field with aria-invalid', async () => {
  const user = await openDialog()

  expect(screen.getByLabelText('Email')).toHaveAttribute('aria-invalid', 'false')

  await user.clear(screen.getByLabelText('Email'))
  await user.click(screen.getByRole('button', { name: 'Save changes' }))

  expect(await screen.findByText('Enter a valid email address')).toBeInTheDocument()
  expect(screen.getByLabelText('Email')).toHaveAttribute('aria-invalid', 'true')
})

test('trims whitespace and lowercases the email before submitting', async () => {
  vi.mocked(axios.patch).mockResolvedValue(updatedUser)

  const user = await openDialog()

  await user.clear(screen.getByLabelText('Name'))
  await user.type(screen.getByLabelText('Name'), '  Ada Renamed  ')
  await user.clear(screen.getByLabelText('Email'))
  await user.type(screen.getByLabelText('Email'), 'Ada.Admin@Example.COM')
  await user.type(screen.getByLabelText('Password'), '  newpassword123  ')
  await user.click(screen.getByRole('button', { name: 'Save changes' }))

  expect(axios.patch).toHaveBeenCalledWith('/api/users/1', {
    name: 'Ada Renamed',
    email: 'ada.admin@example.com',
    password: 'newpassword123',
  })
})

test('closes the dialog on success', async () => {
  vi.mocked(axios.patch).mockResolvedValue(updatedUser)

  const user = await openDialog()

  await user.click(screen.getByRole('button', { name: 'Save changes' }))

  await vi.waitFor(() => expect(screen.queryByLabelText('Name')).not.toBeInTheDocument())
})

test('disables the submit button while the request is in flight', async () => {
  vi.mocked(axios.patch).mockReturnValue(new Promise(() => {}))

  const user = await openDialog()

  await user.click(screen.getByRole('button', { name: 'Save changes' }))

  expect(await screen.findByRole('button', { name: 'Saving…' })).toBeDisabled()
})

test('shows a server error and keeps the dialog open when the email is taken', async () => {
  vi.mocked(axios.isAxiosError).mockReturnValue(true)
  vi.mocked(axios.patch).mockRejectedValue({
    response: { data: { error: 'A user with this email already exists' } },
  })

  const user = await openDialog()

  await user.click(screen.getByRole('button', { name: 'Save changes' }))

  expect(await screen.findByText('A user with this email already exists')).toBeInTheDocument()
  expect(screen.getByLabelText('Name')).toBeInTheDocument()
})

test('falls back to a generic message when the failure carries no error text', async () => {
  vi.mocked(axios.patch).mockRejectedValue(new Error('Network Error'))

  const user = await openDialog()

  await user.click(screen.getByRole('button', { name: 'Save changes' }))

  expect(await screen.findByText('Failed to update user')).toBeInTheDocument()
})

test('discards unsaved edits when the dialog is reopened', async () => {
  const user = await openDialog()

  await user.clear(screen.getByLabelText('Name'))
  await user.type(screen.getByLabelText('Name'), 'Abandoned edit')
  await user.keyboard('{Escape}')

  await vi.waitFor(() => expect(screen.queryByLabelText('Name')).not.toBeInTheDocument())

  await user.click(screen.getByRole('button', { name: 'Edit Ada Admin' }))
  expect(screen.getByLabelText('Name')).toHaveValue('Ada Admin')
})

test('clears the server error when the dialog is reopened', async () => {
  vi.mocked(axios.patch).mockRejectedValue(new Error('Network Error'))

  const user = await openDialog()

  await user.click(screen.getByRole('button', { name: 'Save changes' }))
  expect(await screen.findByText('Failed to update user')).toBeInTheDocument()

  await user.keyboard('{Escape}')
  await vi.waitFor(() => expect(screen.queryByLabelText('Name')).not.toBeInTheDocument())

  await user.click(screen.getByRole('button', { name: 'Edit Ada Admin' }))
  expect(screen.queryByText('Failed to update user')).not.toBeInTheDocument()
})

test('repopulates from the latest row data when the user prop changes', async () => {
  // The dialog is mounted per row and stays mounted, so `defaultValues` alone
  // would keep serving the values captured on first render. This is the case
  // that distinguishes resetting on open from relying on those defaults.
  function Harness() {
    const [name, setName] = useState('Ada Admin')
    return (
      <>
        <button type="button" onClick={() => setName('Ada Renamed')}>
          simulate refetch
        </button>
        <EditUserDialog user={{ ...mockUser, name }} />
      </>
    )
  }

  const user = userEvent.setup()
  renderWithQueryClient(<Harness />)

  await user.click(screen.getByRole('button', { name: 'simulate refetch' }))
  await user.click(screen.getByRole('button', { name: 'Edit Ada Renamed' }))

  expect(screen.getByLabelText('Name')).toHaveValue('Ada Renamed')
})
