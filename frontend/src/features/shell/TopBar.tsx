import type { ReactNode } from 'react'
import { useSession } from '../auth/useSession'
import { ThemeToggle } from './ThemeToggle'

/** Product name, the search slot (the editor's search while a project is open), the signed-in name and Sign out. */
export function TopBar({ search }: { search?: ReactNode }) {
  const { user, signOut } = useSession()
  return (
    <header className="flex flex-wrap items-center gap-3 border-b border-border bg-panel px-4 py-2">
      <h1 className="text-lg font-semibold">KWNTO</h1>
      <div data-slot="search" className="flex-1">{search}</div>
      <ThemeToggle />
      {user && (
        <div className="flex items-center gap-2">
          <span data-testid="session-user">{user.name}</span>
          <button type="button" className="btn" onClick={signOut}>Sign out</button>
        </div>
      )}
    </header>
  )
}
