import { useEffect, useState } from 'react'
import { useTeams } from './useTeams'
import { InviteForm } from './InviteForm'
import { InvitesInbox } from './InvitesInbox'

interface TeamDetailProps {
  teamId: string
  onBack: () => void
}

export function TeamDetail({ teamId, onBack }: TeamDetailProps) {
  const [members, setMembers] = useState<{ id: string; name: string; role: string }[]>([])
  const [settings, setSettings] = useState<{ joinCode: string; joinCodeEnabled: boolean } | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [isOwner, setIsOwner] = useState(false)

  useEffect(() => {
    async function load() {
      try {
        const membersList = await (window as any).backend.teams.members(teamId)
        setMembers(membersList)
        const settingsData = await (window as any).backend.teams.settings(teamId)
        setSettings(settingsData)
        const teams = await (window as any).backend.teams.list()
        const team = teams.find((t: any) => t.id === teamId)
        setIsOwner(team?.isOwner ?? false)
      } catch (err: unknown) {
        const e = err as { message?: string }
        setError(e.message ?? 'Failed to load team')
      }
    }
    load()
  }, [teamId])

  const handleRemoveMember = async (memberId: string) => {
    try {
      await (window as any).backend.teams.removeMember(memberId)
      const membersList = await (window as any).backend.teams.members(teamId)
      setMembers(membersList)
    } catch (err: unknown) {
      const e = err as { message?: string }
      setError(e.message ?? 'Failed to remove member')
    }
  }

  const handleRegenerateCode = async () => {
    try {
      const newCode = await (window as any).backend.teams.regenerateJoinCode(teamId)
      setSettings((s) => (s ? { ...s, joinCode: newCode } : null))
    } catch (err: unknown) {
      const e = err as { message?: string }
      setError(e.message ?? 'Failed to regenerate code')
    }
  }

  const handleDeleteTeam = async () => {
    if (confirm('Delete this team?')) {
      try {
        await (window as any).backend.teams.remove(teamId)
        onBack()
      } catch (err: unknown) {
        const e = err as { message?: string }
        setError(e.message ?? 'Failed to delete team')
      }
    }
  }

  return (
    <div>
      <button onClick={onBack}>← Back</button>
      <h2>Team</h2>
      {error && <p data-testid="form-error">{error}</p>}
      <div data-testid="member-list">
        <h3>Members</h3>
        <ul>
          {members.map((m) => (
            <li key={m.id}>
              {m.name} ({m.role})
              {isOwner && m.role !== 'owner' && (
                <button onClick={() => handleRemoveMember(m.id)}>Remove</button>
              )}
            </li>
          ))}
        </ul>
      </div>
      {isOwner && (
        <div>
          <h3>Join Code</h3>
          {settings && (
            <div>
              <span data-testid="join-code">{settings.joinCode}</span>
              <button onClick={() => {
                // Toggle join code enabled
              }}>
                {settings.joinCodeEnabled ? 'Disable' : 'Enable'}
              </button>
              <button onClick={handleRegenerateCode}>Regenerate</button>
            </div>
          )}
          <InviteForm teamId={teamId} />
          <button onClick={handleDeleteTeam}>Delete team</button>
        </div>
      )}
      <InvitesInbox />
    </div>
  )
}
