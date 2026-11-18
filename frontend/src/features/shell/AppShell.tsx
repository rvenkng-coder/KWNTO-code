import type { ReactNode } from 'react'
import { SearchBox } from '../editor/search/SearchBox'
import { useEditor } from '../editor/store/editorStore'
import { TopBar } from './TopBar'

export function AppShell({ children }: { children: ReactNode }) {
  // The search slot shows the editor's search while a project is open (plan Task 13).
  const projectOpen = useEditor((s) => s.status === 'ready')
  return (
    <div className="min-h-screen">
      <TopBar search={projectOpen ? <SearchBox /> : null} />
      <main className={projectOpen ? 'p-3' : 'mx-auto max-w-5xl p-4'}>{children}</main>
    </div>
  )
}
