// The editor's view of a project and its content (ERD). Screens and the editor store use only these types, never a
// PocketBase record. `version` is the counter of the version guard (decision 0002): an update sends the version it last
// saw.

export type NodeColor = 'slate' | 'red' | 'orange' | 'amber' | 'green' | 'teal' | 'blue' | 'purple'
export type CueType = 'audio' | 'lighting' | 'other'
export interface Project {
  id: string
  teamId: string
  name: string
  startNodeId: string | null
  deleted: boolean
  deletedAt: string | null
  version: number
  /** When it was last changed; only set on the team's project list. */ updated?: string
}
export interface ProjectSettings {
  id: string
  projectId: string
  analyticsEnabled: boolean
  version: number
}
export interface Chapter {
  id: string
  projectId: string
  title: string
  position: number
  deleted: boolean
  deletedAt: string | null
  version: number
}
export interface StoryNode {
  id: string
  projectId: string
  chapterId: string
  title: string
  color: NodeColor
  x: number
  y: number
  width: number
  height: number
  coverMediaId: string
  deleted: boolean
  deletedAt: string | null
  version: number
}
export interface ScriptLine {
  id: string
  projectId: string
  nodeId: string
  character: string
  text: string
  sortOrder: number
  version: number
}
export interface Cue {
  id: string
  projectId: string
  nodeId: string
  type: CueType
  text: string
  sortOrder: number
  version: number
}
export interface Connection {
  id: string
  projectId: string
  fromNodeId: string
  toNodeId: string | null
  label: string
  created: string
  version: number
}
export interface ContentRecords {
  projects: Project
  project_settings: ProjectSettings
  chapters: Chapter
  nodes: StoryNode
  script_lines: ScriptLine
  cues: Cue
  connections: Connection
}
export type ContentKind = keyof ContentRecords
export type CreatableKind = 'chapters' | 'nodes' | 'script_lines' | 'cues' | 'connections'
export type RemovableKind = 'script_lines' | 'cues' | 'connections'
export interface EditableFields {
  projects: Pick<Project, 'name' | 'startNodeId' | 'deleted'>
  project_settings: Pick<ProjectSettings, 'analyticsEnabled'>
  chapters: Pick<Chapter, 'title' | 'position' | 'deleted'>
  nodes: Pick<StoryNode, 'title' | 'color' | 'x' | 'y' | 'width' | 'height' | 'coverMediaId' | 'deleted'>
  script_lines: Pick<ScriptLine, 'character' | 'text' | 'sortOrder'>
  cues: Pick<Cue, 'type' | 'text' | 'sortOrder'>
  connections: Pick<Connection, 'label' | 'toNodeId'>
}
export interface ProjectContent {
  project: Project
  settings: ProjectSettings
  chapters: Chapter[]
  nodes: StoryNode[]
  lines: ScriptLine[]
  cues: Cue[]
  connections: Connection[]
}
export type RemoteEvent = {
  [K in ContentKind]: { kind: K; action: 'create' | 'update' | 'delete'; record: ContentRecords[K] }
}[ContentKind]
