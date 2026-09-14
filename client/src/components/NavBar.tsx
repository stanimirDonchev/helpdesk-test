import { useNavigate } from 'react-router'
import { authClient } from '../lib/auth-client'
import './NavBar.css'

export function NavBar() {
  const navigate = useNavigate()
  const { data: session } = authClient.useSession()

  const handleSignOut = async () => {
    await authClient.signOut({
      fetchOptions: {
        onSuccess: () => navigate('/login', { replace: true }),
      },
    })
  }

  return (
    <nav className="nav-bar">
      <span className="nav-bar-brand">Helpdesk</span>
      {session && (
        <div className="nav-bar-user">
          <span>{session.user.name}</span>
          <button type="button" onClick={handleSignOut}>
            Sign out
          </button>
        </div>
      )}
    </nav>
  )
}
