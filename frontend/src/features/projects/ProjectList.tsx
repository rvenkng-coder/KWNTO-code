import { askConfirm } from '../shell/dialogs'
import { useEffect, useMemo, useState, type FormEvent, type ReactNode } from 'react'
import { navigate } from '../shell/useRoute'
import { ToolButton } from '../editor/canvas/ToolButton'
import { ago } from './ago'
import { ProjectPreview } from './ProjectPreview'
import { useProjects } from './useProjects'

const SEARCH_FROM = 6

interface Props { teamId: string; isOwner: boolean; onTrashed?: () => void; onCount?: (n: number) => void; children?: ReactNode }

/** A team's projects (design 5) as cards: a New project card first, then `children` (the Import card), then one card per project. Any member creates and opens them, only the owner trashes them. */
export function ProjectList({ teamId, isOwner, onTrashed, onCount, children }: Props) {
  const { projects, loaded, error, create, trash } = useProjects(teamId)
  const [adding, setAdding] = useState(false)
  const [name, setName] = useState('')
  const [query, setQuery] = useState('')
  const [sort, setSort] = useState<'recent' | 'name'>('recent')
  useEffect(() => {
    if (loaded) onCount?.(projects.length)
  }, [loaded, projects.length, onCount])

  const shown = useMemo(() => {
    const q = query.trim().toLowerCase()
    const found = q === '' ? projects : projects.filter((p) => p.name.toLowerCase().includes(q))
    return sort === 'name' ? [...found].sort((a, b) => a.name.localeCompare(b.name)) : found
  }, [projects, query, sort])

  async function submit(e: FormEvent) {
    e.preventDefault()
    const trimmed = name.trim()
    if (trimmed !== '' && (await create(trimmed))) {
      setName('')
      setAdding(false)
    }
  }

  return (
    <section data-testid="project-list" data-loaded={loaded} className="flex flex-col gap-3">
      <div className="flex flex-wrap items-center gap-2">
        <h3 className="mr-auto">Projects</h3>
        {projects.length >= SEARCH_FROM && (
          <>
            <input className="field w-48" type="search" placeholder="Search projects" aria-label="Search projects" value={query} onChange={(e) => setQuery(e.target.value)} />
            <select className="field w-auto" aria-label="Sort projects" value={sort} onChange={(e) => setSort(e.target.value as 'recent' | 'name')}>
              <option value="recent">Recently edited</option>
              <option value="name">Name</option>
            </select>
          </>
        )}
      </div>
      {error && <p role="alert">{error}</p>}
      <div className="grid gap-3 [grid-template-columns:repeat(auto-fill,minmax(14rem,1fr))]">
        {adding
          ? (
            <form className="flex flex-col gap-2 rounded-[var(--radius)] border border-border bg-card p-3" onSubmit={submit}>
              <label className="flex flex-col gap-1">
                <span>Project name</span>
                <input className="field" autoFocus placeholder="Project name" aria-label="Project name" value={name} onChange={(e) => setName(e.target.value)} />
              </label>
              <div className="flex gap-2">
                <button type="submit" className="btn-primary" disabled={name.trim() === ''}>Create project</button>
                <button type="button" className="btn" onClick={() => { setAdding(false); setName('') }}>Cancel</button>
              </div>
            </form>
          )
          : (
            <button type="button" className="flex min-h-32 flex-col items-center justify-center gap-1 rounded-[var(--radius)] border border-dashed border-border bg-transparent p-3 text-muted hover:border-accent hover:text-accent"
              onClick={() => setAdding(true)}>
              <span aria-hidden="true" className="text-2xl leading-none">+</span>
              <span>New project</span>
            </button>
          )}
        {children}
        <ul className="contents">
          {shown.map((p) => (
            <li key={p.id} data-testid="project-card" className="flex flex-col gap-2 rounded-[var(--radius)] border border-border bg-card p-3">
              <div className="flex items-center gap-2">
                <button type="button" className="link-button min-w-0 flex-1 truncate text-left font-semibold" onClick={() => navigate({ name: 'project', projectId: p.id, chapterId: null })}>
                  {p.name}
                </button>
                {isOwner && (
                  <ToolButton icon="trash" name="Move to trash" danger align="end" onClick={() => {
                    void askConfirm(`Move "${p.name}" to the trash?`, 'Move to trash').then((yes) => yes && trash(p)).then((ok) => ok && onTrashed?.())
                  }} />
                )}
              </div>
              <ProjectPreview projectId={p.id} />
              {ago(p.updated) !== '' && <p className="text-xs text-muted">Edited {ago(p.updated)}</p>}
            </li>
          ))}
        </ul>
      </div>
      {loaded && projects.length > 0 && shown.length === 0 && <p className="text-muted">No project matches "{query}".</p>}
    </section>
  )
}
