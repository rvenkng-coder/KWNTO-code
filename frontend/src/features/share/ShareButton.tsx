import { useState } from 'react'
import { ShareDialog } from './ShareDialog'

/** Opens the share dialog (shown inside `MemberOnly`: an edit-link holder cannot make links). */
export function ShareButton({ projectId, projectName }: { projectId: string; projectName: string }) {
  const [open, setOpen] = useState(false)
  return (
    <>
      <button type="button" className="btn self-start" onClick={() => setOpen(true)}>Share</button>
      {open && <ShareDialog projectId={projectId} projectName={projectName} onClose={() => setOpen(false)} />}
    </>
  )
}
