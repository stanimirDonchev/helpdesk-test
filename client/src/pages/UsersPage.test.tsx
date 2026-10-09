import { screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import axios from 'axios'
import { expect, test, vi } from 'vitest'
import { renderWithQueryClient } from '../test/render-with-query'
import { UsersPage } from './UsersPage'

vi.mock('axios')

async function openCreateUserDialog() {
  vi.mocked(axios.get).mockResolvedValue({ data: { users: [] } })

  const user = userEvent.setup()
  renderWithQueryClient(<UsersPage />)

  await user.click(screen.getByRole('button', { name: 'Create user' }))
  expect(await screen.findByRole('dialog')).toBeInTheDocument()

  return user
}

test('renders the heading regardless of load state', () => {
  vi.mocked(axios.get).mockReturnValue(new Promise(() => {}))

  renderWithQueryClient(<UsersPage />)

  expect(screen.getByRole('heading', { name: 'Users' })).toBeInTheDocument()
})

test('renders a button to create a user', () => {
  vi.mocked(axios.get).mockReturnValue(new Promise(() => {}))

  renderWithQueryClient(<UsersPage />)

  expect(screen.getByRole('button', { name: 'Create user' })).toBeInTheDocument()
})

test('does not show the create user dialog until the button is clicked', () => {
  vi.mocked(axios.get).mockReturnValue(new Promise(() => {}))

  renderWithQueryClient(<UsersPage />)

  expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
})

test('shows the create user dialog when the button is clicked', async () => {
  await openCreateUserDialog()

  expect(screen.getByRole('heading', { name: 'Create user' })).toBeInTheDocument()
  expect(screen.getByLabelText('Name')).toBeInTheDocument()
})

test('hides the create user dialog when escape is pressed', async () => {
  const user = await openCreateUserDialog()

  await user.keyboard('{Escape}')

  await vi.waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument())
})

test('hides the create user dialog when clicking outside of it', async () => {
  const user = await openCreateUserDialog()

  // the page behind the dialog is inert while it's open, so body is the only clickable "outside"
  await user.click(document.body)

  await vi.waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument())
})
