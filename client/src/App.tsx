import { useEffect, useState } from 'react'
import type { HealthResponse } from 'shared/api-types'
import './App.css'

function App() {
  const [status, setStatus] = useState('Loading...')

  useEffect(() => {
    fetch('/api/health')
      .then((res) => res.json() as Promise<HealthResponse>)
      .then((data) => setStatus(data.status))
      .catch(() => setStatus('Failed to reach the API'))
  }, [])

  return (
    <section id="center">
      <h1>Helpdesk</h1>
      <p>API status: {status}</p>
    </section>
  )
}

export default App
