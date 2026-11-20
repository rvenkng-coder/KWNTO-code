// Share links as the screens see them (plan 2026-11-20-sharing Task 4; ERD `share_links`,
// `link_grants`). `ProjectFile` is the project file of docs/developer/project-file.md.

export type SharePermission = 'view' | 'comment' | 'edit'
export type ShareKind = 'live' | 'snapshot'
export interface ShareLink { id: string; projectId: string; token: string; permission: SharePermission; kind: ShareKind; revoked: boolean; created: string }
export interface Grant { projectId: string; projectName: string; permission: SharePermission }

export interface ProjectFile {
  format: 'kwnto-project'
  version: 1
  exportedAt: string
  project: { name: string; startNode: string | null }
  chapters: { id: string; title: string; position: number }[]
  nodes: { id: string; chapter: string; title: string; color: string; x: number; y: number }[]
  lines: { id: string; node: string; character: string; text: string; sortOrder: number }[]
  cues: { id: string; node: string; type: string; text: string; sortOrder: number }[]
  connections: { id: string; from: string; to: string | null; label: string }[]
  media: { id: string; node: string; title: string; kind: string }[]
}

export type ShareOpen =
  | { permission: 'view' | 'comment'; kind: ShareKind; projectId: string; projectName: string; file: ProjectFile }
  | { permission: 'edit'; projectId: string }
