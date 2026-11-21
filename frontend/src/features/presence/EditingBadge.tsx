import { useSession } from '../auth/useSession'
import { activeEditors, editingLabel, editorsOf } from './presenceModel'
import { usePresenceStore } from './usePresence'

/** "<name> is editing" for a node, or for one field of it. Nothing when nobody else is. */
export function EditingBadge({ nodeId, field }: { nodeId: string; field?: string }) {
  const { user } = useSession()
  const rows = usePresenceStore((s) => s.rows)
  const seenAt = usePresenceStore((s) => s.seenAt)
  const now = usePresenceStore((s) => s.now)
  const timeoutMs = usePresenceStore((s) => s.timeoutMs)
  const label = editingLabel(editorsOf(activeEditors(Object.values(rows), seenAt, now, timeoutMs, user === null ? '' : user.id), nodeId, field))
  if (label === '') return null
  return <span data-testid="editing-badge" className="text-xs text-accent">{label}</span>
}
