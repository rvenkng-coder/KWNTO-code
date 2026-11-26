import type { TeamMember, TeamSettings } from '../../backend/types'
import { Avatar } from './Avatar'

interface MemberListProps {
  members: TeamMember[]
  isOwner: boolean
  loaded: boolean
  onRemove: (memberId: string) => void
}

export function MemberList({ members, isOwner, loaded, onRemove }: MemberListProps) {
  return (
    <div data-testid="member-list" data-loaded={loaded} className="panel flex flex-col gap-2">
      <h3 className="section-label">Members ({members.length})</h3>
      <ul className="flex flex-col gap-1">
        {members.map((m) => (
          <li key={m.id} className="flex items-center gap-2 py-0.5">
            <Avatar name={m.name} />
            <span className="min-w-0 flex-1 truncate">
              {m.name} ({m.role})
            </span>
            {isOwner && m.role !== 'owner' && (
              <button className="btn-quiet" onClick={() => onRemove(m.id)}>
                Remove
              </button>
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
      <span data-testid="join-code" className="font-mono">
        {settings.joinCode}
      </span>
      <button className="btn" onClick={onToggle}>
        {settings.joinCodeEnabled ? 'Disable' : 'Enable'}
      </button>
      <button className="btn" onClick={onRegenerate}>
        Regenerate
      </button>
    </div>
  )
}
