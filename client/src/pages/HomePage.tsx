import { useEffect, useState } from 'react'
import type { HealthResponse } from 'shared/api-types'

export function HomePage() {
  const [status, setStatus] = useState('Loading...')

  useEffect(() => {
    fetch('/api/health')
      .then((res) => res.json() as Promise<HealthResponse>)
      .then((data) => setStatus(data.status))
      .catch(() => setStatus('Failed to reach the API'))
  }, [])

  const statusVariant = status === 'ok' ? 'success' : status === 'Loading...' ? 'pending' : 'error'

  const badgeClasses = {
    success: 'bg-emerald-500/12 text-emerald-700',
    pending: 'bg-muted text-muted-foreground',
    error: 'bg-destructive/10 text-destructive',
  }[statusVariant]

  const dotClasses = {
    success: 'bg-emerald-500',
    pending: 'bg-muted-foreground',
    error: 'bg-destructive',
  }[statusVariant]

  return (
    <section className="mx-auto flex max-w-240 flex-col gap-4 px-6 py-10">
      <h1 className="text-xl font-semibold tracking-tight text-foreground">Helpdesk</h1>
      <p className="flex items-center gap-2.5 text-[0.9375rem] text-muted-foreground">
        API status
        <span
          className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[0.8125rem] font-semibold ${badgeClasses}`}
        >
          <span className={`h-1.75 w-1.75 rounded-full ${dotClasses}`} aria-hidden="true" />
          {status}
        </span>
      </p>
    </section>
  )
}
