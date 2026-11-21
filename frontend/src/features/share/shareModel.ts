import type {
  Chapter, Connection, Cue, NodeColor, ProjectContent, ProjectFile, ScriptLine, ShareKind, SharePermission, StoryNode,
} from '../../backend'

// Pure helpers of the share screens (plan 2026-11-20-sharing Task 4, D8 and D9).

/** The address a person pastes to open a link. */
export function shareUrl(origin: string, token: string): string {
  return `${origin}/#/s/${token}`
}

/** A live view re-reads every 30 s while its tab is visible (D9). */
export function shouldRefresh(kind: ShareKind, visible: boolean, lastMs: number, nowMs: number): boolean {
  return kind === 'live' && visible && nowMs - lastMs >= 30000
}

export function permissionLabel(p: SharePermission, k: ShareKind): string {
  if (p === 'view') return k === 'live' ? 'Can view (live)' : 'Can view (snapshot)'
  return p === 'comment' ? 'Can comment' : 'Can edit'
}

/** The viewer's content: the file's own ids, nothing in the trash, version 0 (it is never saved). */
export function contentFromFile(file: ProjectFile, projectId: string): ProjectContent {
  const base = { projectId, version: 0 }
  const chapters: Chapter[] = file.chapters.map((c) => ({ ...base, id: c.id, title: c.title, position: c.position, deleted: false, deletedAt: null }))
  const nodes: StoryNode[] = file.nodes.map((n) => ({
    ...base, id: n.id, chapterId: n.chapter, title: n.title, color: n.color as NodeColor, x: n.x, y: n.y, width: 0, height: 0, deleted: false, deletedAt: null,
  }))
  const lines: ScriptLine[] = file.lines.map((l) => ({ ...base, id: l.id, nodeId: l.node, character: l.character, text: l.text, sortOrder: l.sortOrder }))
  const cues: Cue[] = file.cues.map((q) => ({ ...base, id: q.id, nodeId: q.node, type: q.type as Cue['type'], text: q.text, sortOrder: q.sortOrder }))
  // The file lists choices in their order; `created` keeps that order in the editor's sort.
  const connections: Connection[] = file.connections.map((k, i) => ({
    ...base, id: k.id, fromNodeId: k.from, toNodeId: k.to, label: k.label, created: String(i).padStart(8, '0'),
  }))
  return {
    project: { id: projectId, teamId: '', name: file.project.name, startNodeId: file.project.startNode, deleted: false, deletedAt: null, version: 0 },
    settings: { id: '', projectId, analyticsEnabled: false, version: 0 },
    chapters, nodes, lines, cues, connections,
  }
}
