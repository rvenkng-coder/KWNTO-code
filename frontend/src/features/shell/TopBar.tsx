import type { ReactNode } from 'react'
import { useSession } from '../auth/useSession'
import { SyncStatus } from '../editor/sync/SyncStatus'
import { ThemeToggle } from './ThemeToggle'
import { UserMenu } from './UserMenu'

/** Product name (only outside a project), the project's own controls while one is open, the sync state, the theme slider and the user menu. */
export function TopBar({ project }: { project?: ReactNode }) {
  const { user, signOut } = useSession()
  return (
    <header className="flex flex-wrap items-center gap-3 border-b border-border bg-panel px-4 py-2">
      {!project && <h1 className="text-lg font-semibold">KWNTO</h1>}
      <div data-slot="project" className="flex flex-1 flex-wrap items-center gap-3">{project}</div>
      <SyncStatus />
      <ThemeToggle />
      {user && <UserMenu name={user.name} onSignOut={signOut} />}
    </header>
  )
}
