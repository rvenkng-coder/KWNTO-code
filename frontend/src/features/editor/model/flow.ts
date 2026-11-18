import type { Edge, Node } from '@xyflow/react'
import type { NodeColor, ScriptLine, StoryNode } from '../../../backend'
import type { NodeMarker } from './markers'
import { byOrder } from './sortOrder'
import { isLiveNode, liveConnections, liveNodes, type ContentState, type LinkedConnection } from './state'

// What React Flow draws for one chapter (design 6.1, plan decision D9): node cards with a
// preview of their lines, edges inside the chapter, and tags for links into other chapters.

export interface CrossLink { connectionId: string; targetNodeId: string; targetChapterId: string; text: string }
export interface NodeCardData extends Record<string, unknown> {
  title: string; color: NodeColor; preview: string[]; more: number; marker: NodeMarker; crossLinks: CrossLink[]
}
export type CardNode = Node<NodeCardData, 'card'>

export const PREVIEW_LINES = 3
export const PREVIEW_CHARS = 80

const NO_MARKER: NodeMarker = { isStart: false, isEnd: false, isUnreachable: false }

function previewOf(l: ScriptLine): string {
  const full = l.character === '' ? l.text : `${l.character.toUpperCase()}: ${l.text}`
  return full.length > PREVIEW_CHARS ? `${full.slice(0, PREVIEW_CHARS - 1)}…` : full
}

// PERF: What: group the lines and the cross-chapter links by node in one pass each.
// Why: with 500 nodes and 5,000 lines, asking linesOf and crossLinksOf per node walks every
// line and connection 500 times (millions of steps on each change). Trade-off: two maps are
// built on every call even when the chapter has few nodes.
function linesByNode(s: ContentState, nodeIds: Set<string>): Map<string, ScriptLine[]> {
  const byNode = new Map<string, ScriptLine[]>()
  for (const l of Object.values(s.lines)) {
    if (!nodeIds.has(l.nodeId)) continue
    const list = byNode.get(l.nodeId)
    if (list === undefined) byNode.set(l.nodeId, [l])
    else list.push(l)
  }
  return byNode
}

// Both ends of a connection; liveConnections only returns connections whose ends exist.
function ends(s: ContentState, c: LinkedConnection): { from: StoryNode; to: StoryNode } | null {
  const from = s.nodes[c.fromNodeId]
  const to = s.nodes[c.toNodeId]
  return from === undefined || to === undefined ? null : { from, to }
}

function crossLinksByNode(s: ContentState, chapterId: string): Map<string, CrossLink[]> {
  const byNode = new Map<string, CrossLink[]>()
  for (const c of liveConnections(s)) {
    const e = ends(s, c)
    if (e === null || e.from.chapterId !== chapterId || e.to.chapterId === chapterId) continue
    const { from, to } = e
    const text = `→ ${s.chapters[to.chapterId]?.title ?? ''}: ${to.title || 'Untitled'}`
    const link = { connectionId: c.id, targetNodeId: to.id, targetChapterId: to.chapterId, text }
    byNode.set(from.id, [...(byNode.get(from.id) ?? []), link])
  }
  return byNode
}

/** Outgoing connections to live nodes in another chapter, as tags. */
export function crossLinksOf(s: ContentState, nodeId: string): CrossLink[] {
  const node = s.nodes[nodeId]
  if (node === undefined || !isLiveNode(s, nodeId)) return []
  return crossLinksByNode(s, node.chapterId).get(nodeId) ?? []
}

/** One React Flow node (type `card`) per live node in the chapter. */
export function toFlowNodes(s: ContentState, chapterId: string, markers: Map<string, NodeMarker>): CardNode[] {
  const nodes = liveNodes(s, chapterId)
  const lines = linesByNode(s, new Set(nodes.map((n) => n.id)))
  const links = crossLinksByNode(s, chapterId)
  return nodes.map((n) => {
    const own = (lines.get(n.id) ?? []).sort(byOrder)
    const data: NodeCardData = {
      title: n.title, color: n.color, preview: own.slice(0, PREVIEW_LINES).map(previewOf),
      more: Math.max(0, own.length - PREVIEW_LINES), marker: markers.get(n.id) ?? NO_MARKER, crossLinks: links.get(n.id) ?? [],
    }
    return { id: n.id, type: 'card', position: { x: n.x, y: n.y }, data }
  })
}

/** Live connections with both ends in the chapter; the label is the connection's label. */
export function toFlowEdges(s: ContentState, chapterId: string): Edge[] {
  return liveConnections(s)
    .filter((c) => {
      const e = ends(s, c)
      if (e === null) return false
      const { from, to } = e
      return from.chapterId === chapterId && to.chapterId === chapterId
    })
    .map((c) => ({ id: c.id, source: c.fromNodeId, target: c.toNodeId, label: c.label }))
}
