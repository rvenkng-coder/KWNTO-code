import { useState, type FormEvent } from 'react'
import { navigate } from '../shell/useRoute'
import { useProjects } from './useProjects'

/** A team's projects (design 5): any member creates and opens them, only the owner trashes them. */
export function ProjectList({ teamId, isOwner, onTrashed }: { teamId: string; isOwner: boolean; onTrashed?: () => void }) {
  const { projects, loaded, error, create, trash } = useProjects(teamId)
  const [name, setName] = useState('')

  async function submit(e: FormEvent) {
    e.preventDefault()
    const trimmed = name.trim()
    if (trimmed !== '' && (await create(trimmed))) setName('')
  }

  return (
    <div data-testid="project-list" data-loaded={loaded} className="panel flex flex-col gap-2">
      <h3>Projects</h3>
      {error && <p role="alert">{error}</p>}
      <form className="flex flex-wrap gap-2" onSubmit={submit}>
        <label className="flex-1">
          <span className="sr-only">Project name</span>
          <input className="field" placeholder="Project name" aria-label="Project name" value={name} onChange={(e) => setName(e.target.value)} />
        </label>
        <button type="submit" className="btn-primary" disabled={name.trim() === ''}>New project</button>
      </form>
      <ul className="flex flex-col gap-1">
        {projects.map((p) => (
          <li key={p.id} className="flex items-center gap-2">
            <button type="button" className="link-button" onClick={() => navigate({ name: 'project', projectId: p.id, chapterId: null })}>
              {p.name}
            </button>
            {isOwner && (
              <button
                type="button"
                className="btn-danger"
                onClick={() => {
                  if (confirm(`Move "${p.name}" to the trash?`)) void trash(p).then(onTrashed)
                }}
              >
                Move to trash
              </button>
            )}
          </li>
        ))}
      </ul>
    </div>
  )
}
