import type { Connection, Cue, ScriptLine, StoryNode } from '../../../backend'
import { cuesOf, linesOf, liveNodes, type ContentState } from './state'

// The in-app clipboard (plan D11): selected nodes with their lines and cues and the
// connections between them. A paste makes new records with new ids in the target chapter,
// each paste 40 px further right and down.

export interface Clip { nodes: StoryNode[]; lines: ScriptLine[]; cues: Cue[]; connections: Connection[] }
export const PASTE_OFFSET = 40

export function copySelection(s: ContentState, nodeIds: string[]): Clip | null {
  const wanted = new Set(nodeIds)
  const nodes = liveNodes(s).filter((n) => wanted.has(n.id))
  if (nodes.length === 0) return null
  const ids = new Set(nodes.map((n) => n.id))
  return {
    nodes,
    lines: nodes.flatMap((n) => linesOf(s, n.id)),
    cues: nodes.flatMap((n) => cuesOf(s, n.id)),
    connections: Object.values(s.connections).filter((c) => ids.has(c.fromNodeId) && ids.has(c.toNodeId)),
  }
}

export function buildPaste(clip: Clip, target: { projectId: string; chapterId: string }, pasteCount: number, makeId: () => string): Clip {
  const nodeIds = new Map(clip.nodes.map((n) => [n.id, makeId()]))
  const ref = (id: string) => nodeIds.get(id) ?? id
  const shift = PASTE_OFFSET * pasteCount
  const { projectId } = target
  return {
    nodes: clip.nodes.map((n) => ({ ...n, id: ref(n.id), projectId, chapterId: target.chapterId, x: n.x + shift, y: n.y + shift, version: 0, deleted: false })),
    lines: clip.lines.map((l) => ({ ...l, id: makeId(), projectId, nodeId: ref(l.nodeId), version: 0 })),
    cues: clip.cues.map((c) => ({ ...c, id: makeId(), projectId, nodeId: ref(c.nodeId), version: 0 })),
    connections: clip.connections.map((c) => ({ ...c, id: makeId(), projectId, fromNodeId: ref(c.fromNodeId), toNodeId: ref(c.toNodeId), version: 0 })),
  }
}
