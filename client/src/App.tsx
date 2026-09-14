import { createBrowserRouter } from 'react-router'
import { RouterProvider } from 'react-router/dom'
import { AdminRoute } from './components/AdminRoute'
import { Layout } from './components/Layout'
import { ProtectedRoute } from './components/ProtectedRoute'
import { HomePage } from './pages/HomePage'
import { LoginPage } from './pages/LoginPage'
import { UsersPage } from './pages/UsersPage'

const router = createBrowserRouter([
  { path: '/login', Component: LoginPage },
  {
    Component: ProtectedRoute,
    children: [
      {
        Component: Layout,
        children: [
          { index: true, Component: HomePage },
          {
            Component: AdminRoute,
            children: [{ path: 'users', Component: UsersPage }],
          },
        ],
      },
    ],
  },
])

function App() {
  return <RouterProvider router={router} />
}

export default App
