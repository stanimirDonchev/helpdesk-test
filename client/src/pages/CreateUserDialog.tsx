import { zodResolver } from '@hookform/resolvers/zod'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import axios from 'axios'
import { useState } from 'react'
import { useForm } from 'react-hook-form'
import type { CreateUserResponse } from 'shared/api-types'
import { createUserSchema, type CreateUserFormValues } from 'shared/user-validation'
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

export function CreateUserDialog() {
  const [open, setOpen] = useState(false)
  const [formError, setFormError] = useState('')
  const queryClient = useQueryClient()
  const {
    register,
    handleSubmit,
    reset,
    formState: { errors },
  } = useForm<CreateUserFormValues>({ resolver: zodResolver(createUserSchema) })

  const createUser = useMutation({
    mutationFn: (values: CreateUserFormValues) =>
      axios.post<CreateUserResponse>('/api/users', values).then((res) => res.data.user),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['users'] })
      reset()
      setOpen(false)
    },
    onError: (error) => {
      const message = axios.isAxiosError(error) ? (error.response?.data as { error?: string } | undefined)?.error : undefined
      setFormError(message || 'Failed to create user')
    },
  })

  const onSubmit = (values: CreateUserFormValues) => {
    setFormError('')
    createUser.mutate(values)
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        setOpen(next)
        if (!next) {
          reset()
          setFormError('')
        }
      }}
    >
      <DialogTrigger render={<Button>Create user</Button>} />
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Create user</DialogTitle>
        </DialogHeader>

        <form className="flex flex-col gap-4.5" onSubmit={handleSubmit(onSubmit)} noValidate>
          <UserFormFields register={register} errors={errors} idPrefix="create-user" />

          {formError && (
            <p className="rounded-lg bg-destructive/10 px-3 py-2.5 text-sm text-destructive" role="alert">
              {formError}
            </p>
          )}

          <DialogFooter>
            <Button type="submit" disabled={createUser.isPending}>
              {createUser.isPending ? 'Creating…' : 'Create user'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
