import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { createMemoryRouter, RouterProvider } from 'react-router'
import { afterEach, beforeEach, expect, test, vi } from 'vitest'
import { LoginPage } from './LoginPage'

const { useSessionMock, signInEmailMock } = vi.hoisted(() => ({
  useSessionMock: vi.fn(),
  signInEmailMock: vi.fn(),
}))

vi.mock('../lib/auth-client', () => ({
  authClient: {
    useSession: useSessionMock,
    signIn: { email: signInEmailMock },
  },
}))

function renderLoginPage() {
  const router = createMemoryRouter(
    [
      { path: '/login', Component: LoginPage },
      { path: '/', element: <p>Homepage</p> },
    ],
    { initialEntries: ['/login'] },
  )
  render(<RouterProvider router={router} />)
}

beforeEach(() => {
  useSessionMock.mockReturnValue({ data: null, isPending: false })
})

afterEach(() => {
  vi.clearAllMocks()
})

test('redirects to the homepage once signed in', async () => {
  const user = userEvent.setup()
  signInEmailMock.mockImplementation(async (_body, callbacks) => {
    callbacks?.onSuccess?.()
  })

  renderLoginPage()

  await user.type(screen.getByLabelText('Email'), 'admin@example.com')
  await user.type(screen.getByLabelText('Password'), '123456')
  await user.click(screen.getByRole('button', { name: 'Sign in' }))

  expect(await screen.findByText('Homepage')).toBeInTheDocument()
})

test('shows an error message when sign in fails', async () => {
  const user = userEvent.setup()
  signInEmailMock.mockImplementation(async (_body, callbacks) => {
    callbacks?.onError?.({ error: { message: 'Invalid email or password' } })
  })

  renderLoginPage()

  await user.type(screen.getByLabelText('Email'), 'admin@example.com')
  await user.type(screen.getByLabelText('Password'), 'wrong-password')
  await user.click(screen.getByRole('button', { name: 'Sign in' }))

  expect(await screen.findByRole('alert')).toHaveTextContent('Invalid email or password')
})

test('shows validation errors and does not call sign in when fields are empty', async () => {
  const user = userEvent.setup()

  renderLoginPage()

  await user.click(screen.getByRole('button', { name: 'Sign in' }))

  expect(await screen.findByText('Enter a valid email address')).toBeInTheDocument()
  expect(screen.getByText('Password is required')).toBeInTheDocument()
  expect(signInEmailMock).not.toHaveBeenCalled()
})

test('redirects an already-signed-in user straight to the homepage', () => {
  useSessionMock.mockReturnValue({ data: { user: { name: 'Admin' } }, isPending: false })

  renderLoginPage()

  expect(screen.getByText('Homepage')).toBeInTheDocument()
})
