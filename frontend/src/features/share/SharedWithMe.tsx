import { useEffect, useState } from 'react'
import { backend, type Grant } from '../../backend'
import { navigate } from '../shell/useRoute'

/** Projects the person was given an edit link to (design 5, D8). Comment links are reopened through the link itself. */
export function SharedWithMe() {
  const [grants, setGrants] = useState<Grant[]>([])
  useEffect(() => {
    let cancelled = false
    backend.shares.myGrants().then((rows) => {
      if (!cancelled) setGrants(rows)
    }).catch(() => undefined)
    return () => {
      cancelled = true
    }
  }, [])
  return (
    <section data-testid="shared-with-me" className="panel flex flex-col gap-1">
      <h3 className="font-semibold">Shared with me</h3>
      {grants.length === 0 && <p className="text-sm text-muted">Nothing is shared with you.</p>}
      <ul className="flex flex-col gap-1">
        {grants.map((g) => (
          <li key={g.projectId}>
            <button type="button" className="link-button" onClick={() => navigate({ name: 'project', projectId: g.projectId, chapterId: null })}>{g.projectName}</button>
          </li>
        ))}
      </ul>
    </section>
  )
}
