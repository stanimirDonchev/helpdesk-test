import { createBrowserRouter } from 'react-router'
import { RouterProvider } from 'react-router/dom'
import { Layout } from './components/Layout'
import { ProtectedRoute } from './components/ProtectedRoute'
import { HomePage } from './pages/HomePage'
import { LoginPage } from './pages/LoginPage'

const router = createBrowserRouter([
  { path: '/login', Component: LoginPage },
  {
    Component: ProtectedRoute,
    children: [
      {
        Component: Layout,
        children: [{ index: true, Component: HomePage }],
      },
    ],
  },
])

function App() {
  return <RouterProvider router={router} />
}

export default App
