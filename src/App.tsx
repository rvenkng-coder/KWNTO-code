import { useEffect, useState } from 'react'
import { backend } from './backend'
import { useSession } from './features/auth/useSession'
import { AuthScreen } from './features/auth/AuthScreen'
import { TeamsScreen } from './features/teams/TeamsScreen'

function App() {
  const [status, setStatus] = useState<'checking' | 'connected' | 'unreachable'>('checking')
  const { user, refresh } = useSession()

  useEffect(() => {
    backend.health().then((ok) => setStatus(ok ? 'connected' : 'unreachable'))
  }, [])

  // The stored session keeps the `verified` flag it had at sign-in. Refresh it when the
  // app opens and when the window regains focus (for example after the email link),
  // so the verification gate lifts without signing out and in again.
  const signedIn = user !== null
  useEffect(() => {
    if (!signedIn) return
    void refresh()
    const onFocus = () => void refresh()
    window.addEventListener('focus', onFocus)
    return () => window.removeEventListener('focus', onFocus)
  }, [signedIn, refresh])

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
