import { useEffect, useState } from 'react'
import { backend } from '../../backend'
import { ShareDialog } from './ShareDialog'

/** Opens the share dialog. Only members of the project's team see it: an edit-link holder cannot make links. */
export function ShareButton({ projectId, teamId, projectName }: { projectId: string; teamId: string; projectName: string }) {
  const [member, setMember] = useState(false)
  const [open, setOpen] = useState(false)
  useEffect(() => {
    let cancelled = false
    backend.teams.list().then((teams) => {
      if (!cancelled) setMember(teams.some((t) => t.id === teamId))
    }).catch(() => undefined)
    return () => {
      cancelled = true
    }
  }, [teamId])
  if (!member) return null
  return (
    <>
      <button type="button" className="btn self-start" onClick={() => setOpen(true)}>Share</button>
      {open && <ShareDialog projectId={projectId} projectName={projectName} onClose={() => setOpen(false)} />}
    </>
  )
}
