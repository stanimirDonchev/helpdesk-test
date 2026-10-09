import { useMutation, useQueryClient } from '@tanstack/react-query'
import axios from 'axios'
import { Trash2Icon } from 'lucide-react'
import { useState } from 'react'
import type { DeleteUserResponse, UserSummary } from 'shared/api-types'
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from '@/components/ui/alert-dialog'
import { Button } from '@/components/ui/button'
import { authClient } from '@/lib/auth-client'

export function DeleteUserDialog({ user }: { user: UserSummary }) {
  const { data: session } = authClient.useSession()
  const [open, setOpen] = useState(false)
  const [formError, setFormError] = useState('')
  const queryClient = useQueryClient()

  const deleteUser = useMutation({
    mutationFn: () =>
      axios.delete<DeleteUserResponse>(`/api/users/${user.id}`).then((res) => res.data.user),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['users'] })
      setOpen(false)
    },
    onError: (error) => {
      const message = axios.isAxiosError(error)
        ? (error.response?.data as { error?: string } | undefined)?.error
        : undefined
      setFormError(message || 'Failed to delete user')
    },
  })

  // Deleting yourself would revoke your own sessions and sign you out of the
  // only role that can undo it, so the control isn't offered at all. The server
  // refuses it too -- this is just the affordance matching the rule.
  if (session?.user.id === user.id) {
    return null
  }

  return (
    <AlertDialog
      open={open}
      onOpenChange={(next) => {
        setOpen(next)
        if (!next) {
          setFormError('')
        }
      }}
    >
      <AlertDialogTrigger render={<Button variant="ghost" size="icon-sm" />}>
        <Trash2Icon />
        <span className="sr-only">Delete {user.name}</span>
      </AlertDialogTrigger>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Delete user</AlertDialogTitle>
          <AlertDialogDescription>
            {user.name} ({user.email}) will be signed out immediately and will no longer appear in
            the list. The account is kept so their history stays intact, which means their email
            address stays taken and cannot be used for a new user.
          </AlertDialogDescription>
        </AlertDialogHeader>

        {formError && (
          <p className="rounded-lg bg-destructive/10 px-3 py-2.5 text-sm text-destructive" role="alert">
            {formError}
          </p>
        )}

        <AlertDialogFooter>
          <AlertDialogCancel disabled={deleteUser.isPending}>Cancel</AlertDialogCancel>
          {/* `AlertDialogAction` is a plain Button rather than a Close, so the
              dialog stays open until the mutation succeeds -- which is what
              lets an error render inline above instead of vanishing. */}
          <AlertDialogAction
            variant="destructive"
            disabled={deleteUser.isPending}
            onClick={() => {
              setFormError('')
              deleteUser.mutate()
            }}
          >
            {deleteUser.isPending ? 'Deleting…' : 'Delete user'}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  )
}
