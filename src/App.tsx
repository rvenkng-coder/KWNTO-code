import { useEffect, useState } from 'react'
import { backend } from './backend'
import { useSession } from './features/auth/useSession'
import { AuthScreen } from './features/auth/AuthScreen'
import { TeamsScreen } from './features/teams/TeamsScreen'

function App() {
  const [status, setStatus] = useState<'checking' | 'connected' | 'unreachable'>('checking')
  const { user } = useSession()

  useEffect(() => {
    backend.health().then((ok) => setStatus(ok ? 'connected' : 'unreachable'))
  }, [])

  return (
    <>
      <h1>KWNTO</h1>
      <p data-testid="backend-status">
        Backend: {status === 'checking' ? 'checking\u2026' : status === 'connected' ? 'connected' : 'unreachable'}
      </p>
      {user ? <TeamsScreen /> : <AuthScreen />}
    </>
  )
}

export default App
