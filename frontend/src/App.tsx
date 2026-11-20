import { useEffect, useState } from 'react'
import { backend } from './backend'
import { useSession } from './features/auth/useSession'
import { AuthScreen } from './features/auth/AuthScreen'
import { TeamsScreen } from './features/teams/TeamsScreen'
import { EditorScreen } from './features/editor/EditorScreen'
import { TeamDetail } from './features/teams/TeamDetail'
import { AppShell } from './features/shell/AppShell'
import { navigate, useRoute } from './features/shell/useRoute'
import { useAccountTheme } from './features/shell/useAccountTheme'
import { ShareScreen } from './features/share/ShareScreen'

function Backend({ status }: { status: 'checking' | 'connected' | 'unreachable' }) {
  return (
    <p data-testid="backend-status" className="p-4 text-sm text-muted">
      Backend: {status === 'checking' ? 'checking…' : status === 'connected' ? 'connected' : 'unreachable'}
    </p>
  )
}

function App() {
  const [status, setStatus] = useState<'checking' | 'connected' | 'unreachable'>('checking')
  const { user, refresh } = useSession()
  const route = useRoute()

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

  useAccountTheme(signedIn)

  if (!user && route.name === 'share') {
    return <AppShell><ShareScreen token={route.token} /></AppShell>
  }

  if (!user) {
    return (
      <>
        <h1 className="p-4 text-lg font-semibold">KWNTO</h1>
        <Backend status={status} />
        <AuthScreen />
      </>
    )
  }

  return (
    <AppShell>
      <Backend status={status} />
      {route.name === 'share' ? (
        <ShareScreen token={route.token} />
      ) : route.name === 'team' ? (
        <TeamDetail teamId={route.teamId} onBack={() => navigate({ name: 'teams' })} />
      ) : route.name === 'project' ? (
        <EditorScreen projectId={route.projectId} chapterId={route.chapterId} />
      ) : (
        <TeamsScreen />
      )}
    </AppShell>
  )
}

export default App
