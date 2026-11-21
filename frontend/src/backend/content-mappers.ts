import type {
  ContentKind, ContentRecords, CreatableKind, CueType, EditableFields, NodeColor,
} from './content-types'

// Content records between PocketBase (snake_case, `deleted_at` dates, '' for an empty
// relation) and the editor types of content-types.ts. Saving is per attribute (decision
// 0002, design 5): an update body holds only the keys the caller changed.

type Raw = Record<string, unknown>

const COLORS: readonly NodeColor[] = ['slate', 'red', 'orange', 'amber', 'green', 'teal', 'blue', 'purple']
const CUE_TYPES: readonly CueType[] = ['audio', 'lighting', 'other']

const text = (v: unknown): string => (typeof v === 'string' ? v : '')
const num = (v: unknown): number => (typeof v === 'number' ? v : 0)
const trashed = (v: unknown): boolean => typeof v === 'string' && v !== ''
// The trash time as ISO text ("2026-11-20T10:00:00.000Z"), or null when not trashed.
const deletedAt = (v: unknown): string | null => (trashed(v) ? (v as string).replace(' ', 'T') : null)
const color = (v: unknown): NodeColor => COLORS.find((c) => c === v) ?? 'slate'
const cueType = (v: unknown): CueType => CUE_TYPES.find((t) => t === v) ?? 'other'

const READERS: { [K in ContentKind]: (r: Raw) => ContentRecords[K] } = {
  projects: (r) => ({
    id: text(r.id), teamId: text(r.team), name: text(r.name),
    startNodeId: text(r.start_node) || null, deleted: trashed(r.deleted_at), deletedAt: deletedAt(r.deleted_at), version: num(r.version),
  }),
  project_settings: (r) => ({
    id: text(r.id), projectId: text(r.project), analyticsEnabled: r.analytics_enabled === true, version: num(r.version),
  }),
  chapters: (r) => ({
    id: text(r.id), projectId: text(r.project), title: text(r.title), position: num(r.position),
    deleted: trashed(r.deleted_at), deletedAt: deletedAt(r.deleted_at), version: num(r.version),
  }),
  nodes: (r) => ({
    id: text(r.id), projectId: text(r.project), chapterId: text(r.chapter), title: text(r.title),
    color: color(r.color), x: num(r.x), y: num(r.y), deleted: trashed(r.deleted_at), deletedAt: deletedAt(r.deleted_at), version: num(r.version),
  }),
  script_lines: (r) => ({
    id: text(r.id), projectId: text(r.project), nodeId: text(r.node), character: text(r.character),
    text: text(r.text), sortOrder: num(r.sort_order), version: num(r.version),
  }),
  cues: (r) => ({
    id: text(r.id), projectId: text(r.project), nodeId: text(r.node), type: cueType(r.type),
    text: text(r.text), sortOrder: num(r.sort_order), version: num(r.version),
  }),
  connections: (r) => ({
    id: text(r.id), projectId: text(r.project), fromNodeId: text(r.from_node), toNodeId: text(r.to_node) || null,
    label: text(r.label), created: text(r.created).replace(' ', 'T'), version: num(r.version),
  }),
}

export function fromRecord<K extends ContentKind>(kind: K, rec: Raw): ContentRecords[K] {
  return READERS[kind](rec)
}

// Editor names whose stored name differs; every other key is stored under its own name.
const STORED_NAME: Record<string, string> = {
  teamId: 'team', projectId: 'project', chapterId: 'chapter', nodeId: 'node',
  fromNodeId: 'from_node', toNodeId: 'to_node', startNodeId: 'start_node',
  analyticsEnabled: 'analytics_enabled', sortOrder: 'sort_order',
}

// The keys an update may send, per kind (`deleted` is handled on its own as `deleted_at`).
const EDITABLE: { [K in ContentKind]: ReadonlyArray<keyof EditableFields[K]> } = {
  projects: ['name', 'startNodeId'],
  project_settings: ['analyticsEnabled'],
  chapters: ['title', 'position'],
  nodes: ['title', 'color', 'x', 'y'],
  script_lines: ['character', 'text', 'sortOrder'],
  cues: ['type', 'text', 'sortOrder'],
  connections: ['label', 'toNodeId'],
}

const storedName = (key: string): string => STORED_NAME[key] ?? key

/** Only the keys given are sent; `deleted` becomes `deleted_at` (D14), a null relation ''. */
export function toUpdateBody<K extends ContentKind>(kind: K, edits: Partial<EditableFields[K]>): Raw {
  const changes = edits as Raw & { deleted?: boolean }
  const body: Raw = {}
  for (const key of EDITABLE[kind] as readonly string[]) {
    if (changes[key] === undefined) continue
    body[storedName(key)] = changes[key] === null ? '' : changes[key]
  }
  if (changes.deleted !== undefined) {
    Object.assign(body, { deleted_at: changes.deleted ? new Date().toISOString() : '' })
  }
  return body
}

/** The whole record under stored names, with the client-made id; never `version`, `created` or `deleted_at`. A null relation is ''. */
export function toCreateBody<K extends CreatableKind>(_kind: K, record: ContentRecords[K]): Raw {
  const body: Raw = {}
  for (const [key, value] of Object.entries(record)) {
    if (key === 'version' || key === 'deleted' || key === 'created') continue
    body[storedName(key)] = value === null ? '' : value
  }
  return body
}
