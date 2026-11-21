import type { ReactNode } from 'react'
import { EditorHeader } from '../editor/EditorHeader'
import { useEditor } from '../editor/store/editorStore'
import { ConflictDialog } from '../editor/sync/ConflictDialog'
import { DialogHost } from './DialogHost'
import { TopBar } from './TopBar'

export function AppShell({ children }: { children: ReactNode }) {
  // While a project is open the title bar carries its name, Back to teams, Export and Share.
  const projectOpen = useEditor((s) => s.status === 'ready')
  return (
    <div className={projectOpen ? 'flex h-screen flex-col overflow-hidden' : 'min-h-screen'}>
      <ConflictDialog />
      <DialogHost />
      <TopBar project={projectOpen ? <EditorHeader /> : null} />
      <main className={projectOpen ? 'flex min-h-0 flex-1 flex-col p-3' : 'mx-auto max-w-5xl p-4'}>{children}</main>
    </div>
  )
}
