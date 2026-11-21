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
  // Nothing shared: the section stays out of the way (it is still in the page, hidden).
  if (grants.length === 0) return <section data-testid="shared-with-me" hidden />
  return (
    <section data-testid="shared-with-me" className="flex flex-col gap-2">
      <h3 className="section-label">Shared with me</h3>
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
