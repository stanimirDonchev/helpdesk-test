import { zodResolver } from '@hookform/resolvers/zod'
import { useState } from 'react'
import { useForm } from 'react-hook-form'
import { Navigate, useNavigate } from 'react-router'
import { z } from 'zod'
import { authClient } from '../lib/auth-client'
import './LoginPage.css'

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
    <section className="login-page">
      <div className="login-card">
        <h1>Helpdesk</h1>
        <p className="login-subtitle">Sign in to manage tickets</p>

        <form className="login-form" onSubmit={handleSubmit(onSubmit)} noValidate>
          <div className="field">
            <label htmlFor="email">Email</label>
            <input
              id="email"
              type="email"
              autoComplete="email"
              aria-invalid={errors.email ? 'true' : 'false'}
              {...register('email')}
            />
            {errors.email && (
              <p className="field-error" role="alert">
                {errors.email.message}
              </p>
            )}
          </div>

          <div className="field">
            <label htmlFor="password">Password</label>
            <input
              id="password"
              type="password"
              autoComplete="current-password"
              aria-invalid={errors.password ? 'true' : 'false'}
              {...register('password')}
            />
            {errors.password && (
              <p className="field-error" role="alert">
                {errors.password.message}
              </p>
            )}
          </div>

          {formError && (
            <p className="form-error" role="alert">
              {formError}
            </p>
          )}

          <button type="submit" className="btn btn-primary login-submit" disabled={isSubmitting}>
            {isSubmitting ? 'Signing in…' : 'Sign in'}
          </button>
        </form>
      </div>
    </section>
  )
}
