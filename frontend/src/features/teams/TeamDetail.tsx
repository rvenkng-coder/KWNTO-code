import { askConfirm } from '../shell/dialogs'
import { useEffect, useState } from 'react'
import { backend } from '../../backend'
import type { TeamMember, TeamSettings, Team } from '../../backend/types'
import { navigate } from '../shell/useRoute'
import { useTeams } from './useTeams'
import { ProjectList } from '../projects/ProjectList'
import { TeamTrash } from '../trash/TeamTrash'
import { InviteForm } from './InviteForm'
import { MemberList, JoinCodeRow } from './TeamParts'
import { errorMessage } from '../errorMessage'
import { ImportProject } from '../projectFile/ImportProject'

interface TeamDetailProps {
  teamId: string
  onBack: () => void
}

function OwnerPanel({
  teamId,
  settings,
  onDelete,
  onToggle,
  onRegenerate,
  onError,
}: {
  teamId: string
  settings: TeamSettings | null
  onDelete: () => void
  onToggle: (enabled: boolean) => void
  onRegenerate: (code: string) => void
  onError: (msg: string) => void
}) {
  return (
    <div className="panel flex flex-col gap-3">
      <h3>Join Code</h3>
      {settings && (
        <JoinCodeRow
          settings={settings}
          onToggle={async () => {
            try {
              const newEnabled = !settings.joinCodeEnabled
              await backend.teams.setJoinCodeEnabled(teamId, newEnabled)
              onToggle(newEnabled)
            } catch (err: unknown) {
              onError(errorMessage(err, 'Failed to toggle join code'))
            }
          }}
          onRegenerate={async () => {
            try {
              const newCode = await backend.teams.regenerateJoinCode(teamId)
              onRegenerate(newCode)
            } catch (err: unknown) {
              onError(errorMessage(err, 'Failed to regenerate code'))
            }
          }}
        />
      )}
      <InviteForm teamId={teamId} />
      <button className="btn-danger self-start" onClick={onDelete}>Delete team</button>
    </div>
  )
}

export function TeamDetail({ teamId, onBack }: TeamDetailProps) {
  const [members, setMembers] = useState<TeamMember[]>([])
  const [settings, setSettings] = useState<TeamSettings | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [isOwner, setIsOwner] = useState(false)
  const [loaded, setLoaded] = useState(false)
  // Bumped when a project is trashed or restored, so the projects list and the trash both reload.
  const [projectsVersion, setProjectsVersion] = useState(0)
  const refreshProjects = () => setProjectsVersion((v) => v + 1)
  const [team, setTeam] = useState<Team | null>(null)

  useEffect(() => {
    async function load() {
      try {
        const teamsState = useTeams.getState()
        if (teamsState.teams.length === 0) {
          await teamsState.list()
        }
        const found = useTeams.getState().teams.find((t) => t.id === teamId)
        setTeam(found ?? null)
        setIsOwner(found?.isOwner ?? false)
        setMembers(await backend.teams.members(teamId))
        if (found?.isOwner) {
          const settingsData = await backend.teams.settings(teamId)
          setSettings(settingsData)
        }
      } catch (err: unknown) {
        setError(errorMessage(err, 'Failed to load team'))
      } finally {
        setLoaded(true)
      }
    }
    load()
  }, [teamId])
  const handleRemoveMember = async (memberId: string) => {
    try {
      await backend.teams.removeMember(memberId)
      setMembers(await backend.teams.members(teamId))
    } catch (err: unknown) {
      setError(errorMessage(err, 'Failed to remove member'))
    }
  }
  const handleDeleteTeam = async () => {
    try {
      const count = (await backend.projects.list(teamId)).length
      const noun = count === 1 ? 'project' : 'projects'
      if (await askConfirm(count === 0 ? 'Delete this team?' : `Delete this team and its ${count} ${noun}?`, 'Delete team')) {
        await useTeams.getState().remove(teamId)
        navigate({ name: 'teams' })
      }
    } catch (err: unknown) {
      setError(errorMessage(err, 'Failed to delete team'))
    }
  }

  return (
    <div className="flex flex-col gap-3">
      <button className="btn self-start" onClick={onBack}>← Back</button>
      <h2>{team?.name ?? 'Team'}</h2>
      {error && <p data-testid="form-error" role="alert">{error}</p>}
      <MemberList members={members} isOwner={isOwner} loaded={loaded} onRemove={handleRemoveMember} />
      {team !== null && <ProjectList key={`projects-${projectsVersion}`} teamId={teamId} isOwner={isOwner} onTrashed={refreshProjects} />}
      {team !== null && <ImportProject teamId={teamId} />}
      {team !== null && isOwner && <TeamTrash key={`trash-${projectsVersion}`} teamId={teamId} onRestored={refreshProjects} />}
      {isOwner && (
        <OwnerPanel
          teamId={teamId}
          settings={settings}
          onDelete={handleDeleteTeam}
          onToggle={(enabled) => setSettings((s) => (s ? { ...s, joinCodeEnabled: enabled } : null))}
          onRegenerate={(code) => setSettings((s) => (s ? { ...s, joinCode: code } : null))}
          onError={setError}
        />
      )}
    </div>
  )
}
