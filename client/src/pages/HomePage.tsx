import { useEffect, useState } from 'react'
import type { HealthResponse } from 'shared/api-types'
import './HomePage.css'

export function HomePage() {
  const [status, setStatus] = useState('Loading...')

  useEffect(() => {
    fetch('/api/health')
      .then((res) => res.json() as Promise<HealthResponse>)
      .then((data) => setStatus(data.status))
      .catch(() => setStatus('Failed to reach the API'))
  }, [])

  const statusVariant = status === 'ok' ? 'success' : status === 'Loading...' ? 'pending' : 'error'

  return (
    <section className="home-page">
      <h1>Helpdesk</h1>
      <p className="home-status">
        API status
        <span className={`status-badge status-badge--${statusVariant}`}>
          <span className="status-dot" aria-hidden="true" />
          {status}
        </span>
      </p>
    </section>
  )
}
