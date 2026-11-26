import type { RemoteEvent } from '../../../backend'
import { dropRecord, getRecord, putRecord, type ContentState } from './state'

// A teammate's live change applied to the state. A created or updated record whose version is not newer
// than the local copy is ignored (our own echo, or out of order). Returns `s` itself when the event is
// ignored, so a store can skip the update.

function belongsToOpenProject(s: ContentState, event: RemoteEvent): boolean {
  if (s.project === null) return false
  if (event.kind === 'projects') return event.record.id === s.project.id
  return event.record.projectId === s.project.id
}

export function applyRemote(s: ContentState, event: RemoteEvent): ContentState {
  if (!belongsToOpenProject(s, event)) return s
  if (event.action === 'delete') return dropRecord(s, event.kind, event.record.id)
  const existing = getRecord(s, event.kind, event.record.id)
  if (existing !== undefined && existing.version >= event.record.version) return s
  return putRecord(s, event.kind, event.record)
}
