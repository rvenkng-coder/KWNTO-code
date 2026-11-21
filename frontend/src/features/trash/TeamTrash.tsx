import { useCallback, useEffect, useState } from 'react'
import { backend, type Project } from '../../backend'
import { errorMessage } from '../errorMessage'
import { daysLeft, trashLabel } from './trashList'

// The owner's list of trashed projects, under the projects list (design 6.8). Only the owner
// sees it and only the owner's restore is accepted by the server.

export function TeamTrash({ teamId, onRestored }: { teamId: string; onRestored(): void }) {
  const [projects, setProjects] = useState<Project[]>([])
  const [retention, setRetention] = useState<number | null>(null)
  const [error, setError] = useState<string | null>(null)

  // Fixed when the list opens: the labels count whole days, so they need no ticking clock.
  const [now] = useState(() => Date.now())

  const load = useCallback(
    () => Promise.all([backend.projects.listTrashed(teamId), backend.appSettings.get()])
      .then(([list, settings]) => {
        setProjects(list)
        setRetention(settings.trashRetentionDays)
      })
      .catch((err: unknown) => setError(errorMessage(err, 'Failed to load the trash'))),
    [teamId],
  )
  useEffect(() => {
    void load()
  }, [load])

  async function restore(project: Project): Promise<void> {
    setError(null)
    try {
      await backend.projects.restore(project)
      await load()
      onRestored()
    } catch (err: unknown) {
      setError(errorMessage(err, 'Failed to restore the project'))
    }
  }

  return (
    <div data-testid="team-trash" className="panel flex flex-col gap-2">
      <h3>Trash</h3>
      {error && <p role="alert">{error}</p>}
      {retention !== null && projects.length === 0 && <p className="text-muted">No projects in the trash.</p>}
      <ul className="flex flex-col gap-1">
        {retention !== null && projects.map((p) => (
          <li key={p.id} className="flex items-center gap-2">
            <span className="flex-1">{p.name}</span>
            <span className="text-muted">{trashLabel(p.deletedAt === null ? retention : daysLeft(p.deletedAt, retention, now))}</span>
            <button type="button" className="btn" onClick={() => void restore(p)}>Restore</button>
          </li>
        ))}
      </ul>
    </div>
  )
}
