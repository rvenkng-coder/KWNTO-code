import { useEffect, useState } from 'react'
import { backend } from './backend'

function App() {
  const [status, setStatus] = useState<'checking' | 'connected' | 'unreachable'>('checking')

  useEffect(() => {
    backend.health().then((ok) => setStatus(ok ? 'connected' : 'unreachable'))
  }, [])

  return (
    <>
      <h1>KWNTO</h1>
      <p data-testid="backend-status">
        Backend: {status === 'checking' ? 'checking\u2026' : status === 'connected' ? 'connected' : 'unreachable'}
      </p>
    </>
  )
}

export default App
