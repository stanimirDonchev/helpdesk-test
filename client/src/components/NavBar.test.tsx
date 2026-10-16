import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { createMemoryRouter, RouterProvider } from 'react-router'
import { expect, test, vi } from 'vitest'
import { NavBar } from './NavBar'

const { useSessionMock, signOutMock } = vi.hoisted(() => ({
  useSessionMock: vi.fn(),
  signOutMock: vi.fn(),
}))

vi.mock('../lib/auth-client', () => ({
  authClient: {
    useSession: useSessionMock,
    signOut: signOutMock,
  },
}))

function renderNavBar() {
  const router = createMemoryRouter(
    [
      { path: '/', Component: NavBar },
      { path: '/login', element: <p>Login page</p> },
    ],
    { initialEntries: ['/'] },
  )
  render(<RouterProvider router={router} />)
}

test('shows the signed-in user name and signs out', async () => {
  const user = userEvent.setup()
  useSessionMock.mockReturnValue({ data: { user: { name: 'Admin' } }, isPending: false })
  signOutMock.mockImplementation(async ({ fetchOptions }) => {
    fetchOptions?.onSuccess?.()
  })

  renderNavBar()

  expect(screen.getByText('Admin')).toBeInTheDocument()

  await user.click(screen.getByRole('button', { name: 'Sign out' }))

  expect(await screen.findByText('Login page')).toBeInTheDocument()
})

test('links an agent to Tickets but not to Users', () => {
  useSessionMock.mockReturnValue({
    data: { user: { name: 'Gene Agent', role: 'agent' } },
    isPending: false,
  })

  renderNavBar()

  // Working tickets is the agent role, so the link is not admin-gated.
  expect(screen.getByRole('link', { name: 'Tickets' })).toBeInTheDocument()
  expect(screen.queryByRole('link', { name: 'Users' })).not.toBeInTheDocument()
})

test('links an admin to both Tickets and Users', () => {
  useSessionMock.mockReturnValue({
    data: { user: { name: 'Ada Admin', role: 'admin' } },
    isPending: false,
  })

  renderNavBar()

  expect(screen.getByRole('link', { name: 'Tickets' })).toBeInTheDocument()
  expect(screen.getByRole('link', { name: 'Users' })).toBeInTheDocument()
})

test('shows no Tickets link when nobody is signed in', () => {
  useSessionMock.mockReturnValue({ data: null, isPending: false })

  renderNavBar()

  expect(screen.queryByRole('link', { name: 'Tickets' })).not.toBeInTheDocument()
})
