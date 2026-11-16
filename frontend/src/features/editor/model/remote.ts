import type { ContentKind, RemoteEvent } from '../../../backend'
import { dropRecord, putRecord, type ContentState } from './state'

// A teammate's live change applied to the state (plan D15). Returns `s` itself when the
// event is ignored, so a store can skip the update.

const TABLE = { chapters: 'chapters', nodes: 'nodes', script_lines: 'lines', cues: 'cues', connections: 'connections' } as const

function localCopy(s: ContentState, kind: ContentKind, id: string): { version: number } | undefined {
  if (kind === 'projects') return s.project?.id === id ? s.project : undefined
  if (kind === 'project_settings') return s.settings?.id === id ? s.settings : undefined
  return s[TABLE[kind]][id]
}

function belongsToOpenProject(s: ContentState, event: RemoteEvent): boolean {
  if (s.project === null) return false
  if (event.kind === 'projects') return event.record.id === s.project.id
  return event.record.projectId === s.project.id
}

export function applyRemote(s: ContentState, event: RemoteEvent): ContentState {
  if (!belongsToOpenProject(s, event)) return s
  if (event.action === 'delete') return dropRecord(s, event.kind, event.record.id)
  const existing = localCopy(s, event.kind, event.record.id)
  if (existing !== undefined && existing.version >= event.record.version) return s
  return putRecord(s, event.kind, event.record)
}
