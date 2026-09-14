import { zodResolver } from '@hookform/resolvers/zod'
import { useState } from 'react'
import { useForm } from 'react-hook-form'
import { Navigate, useNavigate } from 'react-router'
import { z } from 'zod'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { authClient } from '../lib/auth-client'

const loginSchema = z.object({
  email: z.email({ error: 'Enter a valid email address' }),
  password: z.string().min(1, { error: 'Password is required' }),
})

type LoginFormValues = z.infer<typeof loginSchema>

export function LoginPage() {
  const navigate = useNavigate()
  const { data: session, isPending } = authClient.useSession()
  const [formError, setFormError] = useState('')
  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<LoginFormValues>({ resolver: zodResolver(loginSchema) })

  if (isPending) return null
  if (session) return <Navigate to="/" replace />

  const onSubmit = async (values: LoginFormValues) => {
    setFormError('')

    await authClient.signIn.email(values, {
      onSuccess: () => navigate('/', { replace: true }),
      onError: (ctx) => {
        setFormError(ctx.error.message || 'Failed to sign in')
      },
    })
  }

  return (
    <section className="flex min-h-screen items-center justify-center p-6">
      <Card className="w-full max-w-90">
        <CardHeader>
          <CardTitle className="text-xl">Helpdesk</CardTitle>
          <CardDescription>Sign in to manage tickets</CardDescription>
        </CardHeader>

        <CardContent>
          <form className="flex flex-col gap-4.5" onSubmit={handleSubmit(onSubmit)} noValidate>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="email">Email</Label>
              <Input
                id="email"
                type="email"
                autoComplete="email"
                aria-invalid={errors.email ? 'true' : 'false'}
                {...register('email')}
              />
              {errors.email && (
                <p className="text-[0.8125rem] text-destructive" role="alert">
                  {errors.email.message}
                </p>
              )}
            </div>

            <div className="flex flex-col gap-1.5">
              <Label htmlFor="password">Password</Label>
              <Input
                id="password"
                type="password"
                autoComplete="current-password"
                aria-invalid={errors.password ? 'true' : 'false'}
                {...register('password')}
              />
              {errors.password && (
                <p className="text-[0.8125rem] text-destructive" role="alert">
                  {errors.password.message}
                </p>
              )}
            </div>

            {formError && (
              <p className="rounded-lg bg-destructive/10 px-3 py-2.5 text-sm text-destructive" role="alert">
                {formError}
              </p>
            )}

            <Button type="submit" className="mt-1 w-full" disabled={isSubmitting}>
              {isSubmitting ? 'Signing in…' : 'Sign in'}
            </Button>
          </form>
        </CardContent>
      </Card>
    </section>
  )
}
