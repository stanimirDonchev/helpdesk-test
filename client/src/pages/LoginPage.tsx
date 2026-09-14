import { useState } from 'react'
import type { FormEvent } from 'react'
import { Navigate, useNavigate } from 'react-router'
import { authClient } from '../lib/auth-client'
import './LoginPage.css'

export function LoginPage() {
  const navigate = useNavigate()
  const { data: session, isPending } = authClient.useSession()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [isSubmitting, setIsSubmitting] = useState(false)

  if (isPending) return null
  if (session) return <Navigate to="/" replace />

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    setError('')

    await authClient.signIn.email(
      { email, password },
      {
        onRequest: () => setIsSubmitting(true),
        onSuccess: () => navigate('/', { replace: true }),
        onError: (ctx) => {
          setIsSubmitting(false)
          setError(ctx.error.message || 'Failed to sign in')
        },
      },
    )
  }

  return (
    <section className="login-page">
      <h1>Helpdesk</h1>
      <form onSubmit={handleSubmit}>
        <label htmlFor="email">Email</label>
        <input
          id="email"
          type="email"
          autoComplete="email"
          value={email}
          onChange={(event) => setEmail(event.target.value)}
          required
        />

        <label htmlFor="password">Password</label>
        <input
          id="password"
          type="password"
          autoComplete="current-password"
          value={password}
          onChange={(event) => setPassword(event.target.value)}
          required
        />

        {error && <p role="alert">{error}</p>}

        <button type="submit" disabled={isSubmitting}>
          {isSubmitting ? 'Signing in…' : 'Sign in'}
        </button>
      </form>
    </section>
  )
}
