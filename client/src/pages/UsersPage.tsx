import { useEffect, useState } from 'react'
import type { UserSummary, UsersListResponse } from 'shared/api-types'
import { UserRole } from 'shared/user-types'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '../components/ui/table'

type LoadState = 'loading' | 'loaded' | 'error'

export function UsersPage() {
  const [users, setUsers] = useState<UserSummary[]>([])
  const [state, setState] = useState<LoadState>('loading')

  useEffect(() => {
    fetch('/api/users')
      .then((res) => {
        if (!res.ok) throw new Error(`Request failed: ${res.status}`)
        return res.json() as Promise<UsersListResponse>
      })
      .then((data) => {
        setUsers(data.users)
        setState('loaded')
      })
      .catch(() => setState('error'))
  }, [])

  return (
    <section className="mx-auto flex max-w-240 flex-col gap-4 px-6 py-10">
      <h1 className="text-xl font-semibold tracking-tight text-foreground">Users</h1>

      {state === 'loading' && (
        <p className="text-[0.9375rem] text-muted-foreground">Loading users…</p>
      )}

      {state === 'error' && (
        <p className="text-[0.9375rem] text-destructive">Failed to load users.</p>
      )}

      {state === 'loaded' && users.length === 0 && (
        <p className="text-[0.9375rem] text-muted-foreground">No users found.</p>
      )}

      {state === 'loaded' && users.length > 0 && (
        <div className="rounded-lg border border-border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Name</TableHead>
                <TableHead>Email</TableHead>
                <TableHead>Role</TableHead>
                <TableHead>Joined</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {users.map((user) => (
                <TableRow key={user.id}>
                  <TableCell className="font-medium text-foreground">{user.name}</TableCell>
                  <TableCell className="text-muted-foreground">{user.email}</TableCell>
                  <TableCell>
                    <span
                      className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[0.8125rem] font-semibold ${
                        user.role === UserRole.admin
                          ? 'bg-emerald-500/12 text-emerald-700'
                          : 'bg-muted text-muted-foreground'
                      }`}
                    >
                      {user.role}
                    </span>
                  </TableCell>
                  <TableCell className="text-muted-foreground">
                    {new Date(user.createdAt).toLocaleDateString()}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}
    </section>
  )
}
