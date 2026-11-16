import type {
  Chapter, Connection, ContentKind, ContentRecords, Cue, Project, ProjectContent, ProjectSettings,
  ScriptLine, StoryNode,
} from '../../../backend'
import { byOrder } from './sortOrder'

// The editor's state as plain data (plan Task 8): records by id, and pure functions over it.
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
  project: null, settings: null, chapters: {}, nodes: {}, lines: {}, cues: {}, connections: {},
}

function byId<T extends { id: string }>(records: T[]): Record<string, T> {
  return Object.fromEntries(records.map((r) => [r.id, r]))
}

export function fromContent(c: ProjectContent): ContentState {
  return {
    project: c.project, settings: c.settings, chapters: byId(c.chapters), nodes: byId(c.nodes),
    lines: byId(c.lines), cues: byId(c.cues), connections: byId(c.connections),
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
  return Object.values(s.nodes).filter((n) => isLiveNode(s, n.id) && (chapterId === undefined || n.chapterId === chapterId))
}

export function liveConnections(s: ContentState): Connection[] {
  return Object.values(s.connections).filter((c) => isLiveNode(s, c.fromNodeId) && isLiveNode(s, c.toNodeId))
}

export function linesOf(s: ContentState, nodeId: string): ScriptLine[] {
  return Object.values(s.lines).filter((l) => l.nodeId === nodeId).sort(byOrder)
}

export function cuesOf(s: ContentState, nodeId: string): Cue[] {
  return Object.values(s.cues).filter((c) => c.nodeId === nodeId).sort(byOrder)
}

// The collections that hold many records of one kind (the project and its settings are single).
const TABLE = { chapters: 'chapters', nodes: 'nodes', script_lines: 'lines', cues: 'cues', connections: 'connections' } as const

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
