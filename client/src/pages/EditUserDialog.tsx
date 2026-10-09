import { zodResolver } from '@hookform/resolvers/zod'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import axios from 'axios'
import { PencilIcon } from 'lucide-react'
import { useState } from 'react'
import { useForm } from 'react-hook-form'
import type { UpdateUserRequest, UpdateUserResponse, UserSummary } from 'shared/api-types'
import { updateUserFormSchema, type UpdateUserFormValues } from 'shared/user-validation'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog'
import { UserFormFields } from '@/components/UserFormFields'

export function EditUserDialog({ user }: { user: UserSummary }) {
  const [open, setOpen] = useState(false)
  const [formError, setFormError] = useState('')
  const queryClient = useQueryClient()
  const {
    register,
    handleSubmit,
    reset,
    formState: { errors },
  } = useForm<UpdateUserFormValues>({
    resolver: zodResolver(updateUserFormSchema),
    defaultValues: { name: user.name, email: user.email, password: '' },
  })

  const updateUser = useMutation({
    mutationFn: (values: UpdateUserFormValues) => {
      const payload: UpdateUserRequest = {
        name: values.name,
        email: values.email,
        // Blank means "keep the current password", which on the wire is the
        // field being absent rather than an empty string.
        ...(values.password ? { password: values.password } : {}),
      }
      return axios
        .patch<UpdateUserResponse>(`/api/users/${user.id}`, payload)
        .then((res) => res.data.user)
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['users'] })
      // No `reset()` here: the row data this dialog was opened with is still
      // pre-refetch, so resetting now would pin stale values. Reopening
      // repopulates from the fresh prop instead.
      setOpen(false)
    },
    onError: (error) => {
      const message = axios.isAxiosError(error)
        ? (error.response?.data as { error?: string } | undefined)?.error
        : undefined
      setFormError(message || 'Failed to update user')
    },
  })

  const onSubmit = (values: UpdateUserFormValues) => {
    setFormError('')
    updateUser.mutate(values)
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        setOpen(next)
        if (next) {
          // Repopulate on every open rather than relying on `defaultValues`,
          // which are captured once on mount: this component stays mounted per
          // row, so after a successful edit + refetch the defaults are stale.
          // Also discards edits abandoned on a previous open.
          reset({ name: user.name, email: user.email, password: '' })
          setFormError('')
        }
      }}
    >
      <DialogTrigger render={<Button variant="ghost" size="icon-sm" />}>
        <PencilIcon />
        <span className="sr-only">Edit {user.name}</span>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Edit user</DialogTitle>
        </DialogHeader>

        <form className="flex flex-col gap-4.5" onSubmit={handleSubmit(onSubmit)} noValidate>
          <UserFormFields
            register={register}
            errors={errors}
            idPrefix={`edit-user-${user.id}`}
            passwordHint="Leave blank to keep the current password"
          />

          {formError && (
            <p className="rounded-lg bg-destructive/10 px-3 py-2.5 text-sm text-destructive" role="alert">
              {formError}
            </p>
          )}

          <DialogFooter>
            <Button type="submit" disabled={updateUser.isPending}>
              {updateUser.isPending ? 'Saving…' : 'Save changes'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
