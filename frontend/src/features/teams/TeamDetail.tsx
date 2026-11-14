import { useEffect, useState } from 'react'
import { backend } from '../../backend'
import type { TeamMember, TeamSettings } from '../../backend/types'
import { InviteForm } from './InviteForm'
import { MemberList, JoinCodeRow } from './TeamParts'
import { errorMessage } from '../errorMessage'

interface TeamDetailProps {
  teamId: string
  onBack: () => void
}

export function TeamDetail({ teamId, onBack }: TeamDetailProps) {
  const [members, setMembers] = useState<TeamMember[]>([])
  const [settings, setSettings] = useState<TeamSettings | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [isOwner, setIsOwner] = useState(false)
  const [loaded, setLoaded] = useState(false)

  useEffect(() => {
    async function load() {
      try {
        setMembers(await backend.teams.members(teamId))
        const teams = await backend.teams.list()
        const team = teams.find((t) => t.id === teamId)
        setIsOwner(team?.isOwner ?? false)
        if (team?.isOwner) {
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
      const membersList = await backend.teams.members(teamId)
      setMembers(membersList)
    } catch (err: unknown) {
      setError(errorMessage(err, 'Failed to remove member'))
    }
  }

  const handleRegenerateCode = async () => {
    try {
      const newCode = await backend.teams.regenerateJoinCode(teamId)
      setSettings((s) => (s ? { ...s, joinCode: newCode } : null))
    } catch (err: unknown) {
      setError(errorMessage(err, 'Failed to regenerate code'))
    }
  }

  const handleDeleteTeam = async () => {
    if (confirm('Delete this team?')) {
      try {
        await backend.teams.remove(teamId)
        onBack()
      } catch (err: unknown) {
        setError(errorMessage(err, 'Failed to delete team'))
      }
    }
  }

  const handleToggleJoinCode = async () => {
    try {
      const newEnabled = !settings?.joinCodeEnabled
      await backend.teams.setJoinCodeEnabled(teamId, newEnabled)
      setSettings((s) => (s ? { ...s, joinCodeEnabled: newEnabled } : null))
    } catch (err: unknown) {
      setError(errorMessage(err, 'Failed to toggle join code'))
    }
  }

  return (
    <div className="flex flex-col gap-3">
      <button className="btn self-start" onClick={onBack}>← Back</button>
      <h2>Team</h2>
      {error && <p data-testid="form-error" role="alert">{error}</p>}
      <MemberList members={members} isOwner={isOwner} loaded={loaded} onRemove={handleRemoveMember} />
      {isOwner && (
        <div className="panel flex flex-col gap-3">
          <h3>Join Code</h3>
          {settings && (
            <JoinCodeRow settings={settings} onToggle={handleToggleJoinCode} onRegenerate={handleRegenerateCode} />
          )}
          <InviteForm teamId={teamId} />
          <button className="btn-danger self-start" onClick={handleDeleteTeam}>Delete team</button>
        </div>
      )}
    </div>
  )
}
