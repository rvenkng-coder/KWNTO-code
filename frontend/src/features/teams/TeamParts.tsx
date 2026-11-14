import type { TeamMember, TeamSettings } from '../../backend/types'

interface MemberListProps {
  members: TeamMember[]
  isOwner: boolean
  loaded: boolean
  onRemove: (memberId: string) => void
}

export function MemberList({ members, isOwner, loaded, onRemove }: MemberListProps) {
  return (
    <div data-testid="member-list" data-loaded={loaded} className="panel">
      <h3>Members</h3>
      <ul>
        {members.map((m) => (
          <li key={m.id} className="flex flex-wrap items-center gap-2 py-1">
            {m.name} ({m.role})
            {isOwner && m.role !== 'owner' && (
              <button className="btn" onClick={() => onRemove(m.id)}>Remove</button>
            )}
          </li>
        ))}
      </ul>
    </div>
  )
}

interface JoinCodeRowProps {
  settings: TeamSettings
  onToggle: () => void
  onRegenerate: () => void
}

export function JoinCodeRow({ settings, onToggle, onRegenerate }: JoinCodeRowProps) {
  return (
    <div className="flex flex-wrap items-center gap-2">
      <span data-testid="join-code" className="font-mono">{settings.joinCode}</span>
      <button className="btn" onClick={onToggle}>
        {settings.joinCodeEnabled ? 'Disable' : 'Enable'}
      </button>
      <button className="btn" onClick={onRegenerate}>Regenerate</button>
    </div>
  )
}
