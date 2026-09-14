import { Link, useNavigate } from 'react-router'
import { UserRole } from 'shared/user-types'
import { Avatar, AvatarFallback } from '@/components/ui/avatar'
import { Button } from '@/components/ui/button'
import { authClient } from '../lib/auth-client'

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
    <nav className="sticky top-0 z-10 flex items-center justify-between gap-4 border-b border-border bg-background px-6 py-3.5">
      <div className="flex items-center gap-6">
        <span className="text-[1.0625rem] font-bold tracking-tight text-foreground">Helpdesk</span>
        {session?.user.role === UserRole.admin && (
          <Link
            to="/users"
            className="text-[0.9375rem] font-medium text-muted-foreground hover:text-foreground"
          >
            Users
          </Link>
        )}
      </div>
      {session && (
        <div className="flex items-center gap-2.5">
          <Avatar size="sm">
            <AvatarFallback>{session.user.name.charAt(0).toUpperCase()}</AvatarFallback>
          </Avatar>
          <span className="text-[0.9375rem] font-medium text-foreground">{session.user.name}</span>
          <Button type="button" variant="outline" size="sm" onClick={handleSignOut}>
            Sign out
          </Button>
        </div>
      )}
    </nav>
  )
}
