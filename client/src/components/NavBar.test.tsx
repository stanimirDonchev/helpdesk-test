import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { createMemoryRouter, RouterProvider } from 'react-router'
import { afterEach, expect, test, vi } from 'vitest'
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

afterEach(() => {
  vi.clearAllMocks()
})

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
