import { useEffect, useState } from 'react'
import { backend, type Project } from '../../backend'
import type { Team, TeamMember } from '../../backend/types'
import { ProjectPreview } from '../projects/ProjectPreview'
import { navigate } from '../shell/useRoute'
import { Avatar } from './Avatar'

export const SHOWN_PROJECTS = 3
export const SHOWN_MEMBERS = 5

/** One team on the Teams screen: its name and counts, a preview of its first three projects (the most recently changed) and its first five members. */
export function TeamCard({ team }: { team: Team }) {
  const [projects, setProjects] = useState<Project[] | null>(null)
  const [members, setMembers] = useState<TeamMember[] | null>(null)
  useEffect(() => {
    let current = true
    backend.projects
      .list(team.id)
      .then((p) => current && setProjects(p))
      .catch(() => current && setProjects([]))
    backend.teams
      .members(team.id)
      .then((m) => current && setMembers(m))
      .catch(() => current && setMembers([]))
    return () => {
      current = false
    }
  }, [team.id])
  const open = () => navigate({ name: 'team', teamId: team.id })
  const shown = (projects ?? []).slice(0, SHOWN_PROJECTS)
  return (
    <li
      data-testid="team-card"
      className="flex flex-col gap-3 rounded-[var(--radius)] border border-border bg-card p-3"
    >
      <div className="flex items-start gap-2">
        <div className="flex min-w-0 flex-1 flex-col">
          <button
            type="button"
            className="link-button self-start truncate text-left text-lg font-semibold"
            onClick={open}
          >
            {team.name}
          </button>
          <p className="text-xs text-muted">
            {projects === null ? ' ' : `${projects.length} ${projects.length === 1 ? 'project' : 'projects'}`}
            {members !== null && ` · ${members.length} ${members.length === 1 ? 'member' : 'members'}`}
          </p>
        </div>
        <button type="button" className="btn" onClick={open}>
          Open
        </button>
      </div>
      <div className="flex flex-col gap-1">
        <h4 className="section-label">Projects</h4>
        {projects !== null && projects.length === 0 && <p className="text-muted">No projects yet</p>}
        <div className="grid grid-cols-3 gap-2">
          {shown.map((p) => (
            <button
              key={p.id}
              type="button"
              title={p.name}
              className="flex min-w-0 flex-col gap-1 rounded-base border-0 bg-transparent p-0 text-left"
              onClick={() => navigate({ name: 'project', projectId: p.id, chapterId: null })}
            >
              <ProjectPreview projectId={p.id} compact />
              <span className="truncate text-xs">{p.name}</span>
            </button>
          ))}
        </div>
        {projects !== null && projects.length > SHOWN_PROJECTS && (
          <p className="text-xs text-muted">+{projects.length - SHOWN_PROJECTS} more</p>
        )}
      </div>
      <div className="flex items-center gap-1">
        {(members ?? []).slice(0, SHOWN_MEMBERS).map((m) => (
          <Avatar key={m.id} name={m.name} />
        ))}
        {members !== null && members.length > SHOWN_MEMBERS && (
          <span className="text-xs text-muted">+{members.length - SHOWN_MEMBERS}</span>
        )}
      </div>
    </li>
  )
}
