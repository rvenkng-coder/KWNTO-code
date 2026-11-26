import type {
  Chapter,
  Connection,
  ContentKind,
  ContentRecords,
  Cue,
  Project,
  ProjectContent,
  ProjectSettings,
  ScriptLine,
  StoryNode,
} from '../../../backend'
import { byOrder } from './sortOrder'

// The editor's state as plain data: records by id, and pure functions over it.
// A node is "live" when it and its chapter are not in the trash.

export interface ContentState {
  project: Project | null
  settings: ProjectSettings | null
  chapters: Record<string, Chapter>
  nodes: Record<string, StoryNode>
  lines: Record<string, ScriptLine>
  cues: Record<string, Cue>
  connections: Record<string, Connection>
}

export const EMPTY_STATE: ContentState = {
  project: null,
  settings: null,
  chapters: {},
  nodes: {},
  lines: {},
  cues: {},
  connections: {},
}

function byId<T extends { id: string }>(records: T[]): Record<string, T> {
  return Object.fromEntries(records.map((r) => [r.id, r]))
}

export function fromContent(c: ProjectContent): ContentState {
  return {
    project: c.project,
    settings: c.settings,
    chapters: byId(c.chapters),
    nodes: byId(c.nodes),
    lines: byId(c.lines),
    cues: byId(c.cues),
    connections: byId(c.connections),
  }
}

export function liveChapters(s: ContentState): Chapter[] {
  return Object.values(s.chapters)
    .filter((c) => !c.deleted)
    .sort((a, b) => byOrder({ id: a.id, sortOrder: a.position }, { id: b.id, sortOrder: b.position }))
}

export function isLiveNode(s: ContentState, nodeId: string): boolean {
  const node = s.nodes[nodeId]
  if (node === undefined || node.deleted) return false
  const chapter = s.chapters[node.chapterId]
  return chapter !== undefined && !chapter.deleted
}

export function liveNodes(s: ContentState, chapterId?: string): StoryNode[] {
  return Object.values(s.nodes).filter(
    (n) => isLiveNode(s, n.id) && (chapterId === undefined || n.chapterId === chapterId),
  )
}

/** A connection whose target is set (an empty choice has none). */
export type LinkedConnection = Connection & { toNodeId: string }

/** Both ends live and the target set. */
export function liveConnections(s: ContentState): LinkedConnection[] {
  return Object.values(s.connections).filter(
    (c): c is LinkedConnection => c.toNodeId !== null && isLiveNode(s, c.fromNodeId) && isLiveNode(s, c.toNodeId),
  )
}

export function linesOf(s: ContentState, nodeId: string): ScriptLine[] {
  return Object.values(s.lines)
    .filter((l) => l.nodeId === nodeId)
    .sort(byOrder)
}

export function cuesOf(s: ContentState, nodeId: string): Cue[] {
  return Object.values(s.cues)
    .filter((c) => c.nodeId === nodeId)
    .sort(byOrder)
}

// The collections that hold many records of one kind (the project and its settings are single).
const TABLE = {
  chapters: 'chapters',
  nodes: 'nodes',
  script_lines: 'lines',
  cues: 'cues',
  connections: 'connections',
} as const

export function getRecord<K extends ContentKind>(s: ContentState, kind: K, id: string): ContentRecords[K] | undefined {
  if (kind === 'projects') return (s.project?.id === id ? s.project : undefined) as ContentRecords[K] | undefined
  if (kind === 'project_settings')
    return (s.settings?.id === id ? s.settings : undefined) as ContentRecords[K] | undefined
  return s[TABLE[kind as keyof typeof TABLE]][id] as ContentRecords[K] | undefined
}

export function putRecord<K extends ContentKind>(s: ContentState, kind: K, record: ContentRecords[K]): ContentState {
  if (kind === 'projects') return { ...s, project: record as Project }
  if (kind === 'project_settings') return { ...s, settings: record as ProjectSettings }
  const table = TABLE[kind as keyof typeof TABLE]
  return { ...s, [table]: { ...s[table], [record.id]: record } }
}

export function dropRecord(s: ContentState, kind: ContentKind, id: string): ContentState {
  if (kind === 'projects' || kind === 'project_settings') return s
  const table = TABLE[kind]
  const rest = { ...s[table] }
  delete rest[id]
  return { ...s, [table]: rest }
}

type Table = 'chapters' | 'nodes' | 'lines' | 'cues' | 'connections'
const TABLES: readonly Table[] = ['chapters', 'nodes', 'lines', 'cues', 'connections']

function newer<T extends { version: number }>(local: T | undefined, loaded: T | null): T | null {
  return local !== undefined && loaded !== null && local.version > loaded.version ? local : loaded
}

/**
 * A project loaded again over what is on screen: everything the load holds, except that a record
 * the screen already has in a higher version stays (the load may have been read before my own
 * save landed). Records only the screen has are gone: someone deleted them meanwhile.
 */
export function mergeNewer(local: ContentState, loaded: ContentState): ContentState {
  const merged: ContentState = {
    ...loaded,
    project: newer(local.project ?? undefined, loaded.project),
    settings: newer(local.settings ?? undefined, loaded.settings),
  }
  for (const table of TABLES) {
    const next: Record<string, { version: number }> = {}
    for (const [id, record] of Object.entries(loaded[table])) next[id] = newer(local[table][id], record) ?? record
    ;(merged as unknown as Record<Table, unknown>)[table] = next
  }
  return merged
}

/** What my own saves did while a load was under way: the record the server answered with, or `gone` for a removal. */
export type TouchedMap = Map<string, ContentRecords[ContentKind] | 'gone'>

/**
 * A load may have been read before my own saves landed, so it can hold an older copy of a record I just
 * saved, lack one I just made, or still hold one I just removed. My saves are laid over it.
 */
export function applyTouched(state: ContentState, touched: TouchedMap): ContentState {
  const projectId = state.project?.id
  let out = state
  for (const [key, how] of touched) {
    const [kind, id] = key.split(':') as [ContentKind, string]
    if (how === 'gone') {
      out = dropRecord(out, kind, id)
      continue
    }
    const ownProject = 'projectId' in how ? how.projectId === projectId : how.id === projectId
    const current = getRecord(out, kind, id)
    if (ownProject && (current === undefined || current.version < how.version)) out = putRecord(out, kind, how)
  }
  return out
}
