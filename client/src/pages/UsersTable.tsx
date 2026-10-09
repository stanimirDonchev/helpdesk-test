import { useQuery } from '@tanstack/react-query'
import axios from 'axios'
import type { UsersListResponse } from 'shared/api-types'
import { UserRole } from 'shared/user-types'
import { EditUserDialog } from './EditUserDialog'
import { Skeleton } from '../components/ui/skeleton'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '../components/ui/table'

const SKELETON_ROWS = 5

// Rendered by both the loading and the loaded branch, so the column list only
// has to be kept in sync in one place.
function UsersTableHead() {
  return (
    <TableHeader>
      <TableRow>
        <TableHead>Name</TableHead>
        <TableHead>Email</TableHead>
        <TableHead>Role</TableHead>
        <TableHead>Joined</TableHead>
        <TableHead className="text-right">
          <span className="sr-only">Actions</span>
        </TableHead>
      </TableRow>
    </TableHeader>
  )
}

export function UsersTable() {
  const { data, isPending, isError } = useQuery({
    queryKey: ['users'],
    queryFn: () => axios.get<UsersListResponse>('/api/users').then((res) => res.data.users),
  })

  if (isPending) {
    return (
      <div className="rounded-lg border border-border">
        <Table>
          <UsersTableHead />
          <TableBody>
            {Array.from({ length: SKELETON_ROWS }).map((_, index) => (
              <TableRow key={index}>
                <TableCell>
                  <Skeleton className="h-4 w-32" />
                </TableCell>
                <TableCell>
                  <Skeleton className="h-4 w-48" />
                </TableCell>
                <TableCell>
                  <Skeleton className="h-6 w-16 rounded-full" />
                </TableCell>
                <TableCell>
                  <Skeleton className="h-4 w-20" />
                </TableCell>
                <TableCell className="text-right">
                  <Skeleton className="ml-auto size-7 rounded-lg" />
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
    )
  }

  if (isError) {
    return <p className="text-[0.9375rem] text-destructive">Failed to load users.</p>
  }

  if (data.length === 0) {
    return <p className="text-[0.9375rem] text-muted-foreground">No users found.</p>
  }

  return (
    <div className="rounded-lg border border-border">
      <Table>
        <UsersTableHead />
        <TableBody>
          {data.map((user) => (
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
              <TableCell className="text-right">
                <EditUserDialog user={user} />
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  )
}
