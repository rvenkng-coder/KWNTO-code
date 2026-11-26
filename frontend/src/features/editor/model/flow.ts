import type { Edge, Node } from '@xyflow/react'
import type { Connection, Cue, NodeColor, ScriptLine, StoryNode } from '../../../backend'
import { byCreated } from './choices'
import type { NodeMarker } from './markers'
import { byOrder } from './sortOrder'
import { isLiveNode, liveConnections, liveNodes, type ContentState, type LinkedConnection } from './state'

// What React Flow draws for one chapter (design 6.1): node cards with a
// preview of their lines, edges inside the chapter, and tags for links into other chapters.

export interface CrossLink {
  connectionId: string
  targetNodeId: string
  targetChapterId: string
  text: string
}
export interface CardChoice {
  id: string
  text: string
  untitled: boolean
  linked: boolean
  crossLink: CrossLink | null
}
export interface CardCue {
  tag: 'Audio' | 'Light' | 'Other'
  text: string
}
export interface NodeCardData extends Record<string, unknown> {
  title: string
  color: NodeColor
  preview: string[]
  more: number
  marker: NodeMarker
  choices: CardChoice[]
  cues: CardCue[]
  moreCues: number
  /** The node's cover image (a media id), '' for none. */
  coverMediaId: string
}
export type CardNode = Node<NodeCardData, 'card'>

/** The width of a card that has no size of its own (w-56). */
export const DEFAULT_CARD_WIDTH = 224
export const MIN_CARD_WIDTH = 160
export const MIN_CARD_HEIGHT = 90
export const PREVIEW_LINES = 3
export const PREVIEW_CHARS = 80
export const CUE_LINES = 2
export const NEW_CHOICE_HANDLE = 'new-choice'
export const choiceHandleId = (connectionId: string): string => `choice-${connectionId}`

const CUE_TAG: Record<Cue['type'], CardCue['tag']> = { audio: 'Audio', lighting: 'Light', other: 'Other' }

const NO_MARKER: NodeMarker = { isStart: false, isEnd: false, isUnreachable: false }

function previewOf(l: ScriptLine): string {
  const full = l.character === '' ? l.text : `${l.character.toUpperCase()}: ${l.text}`
  return full.length > PREVIEW_CHARS ? `${full.slice(0, PREVIEW_CHARS - 1)}…` : full
}

// PERF: What: group the lines, the cues and the choices by node in one pass each.
// Why: with 500 nodes and 5,000 lines, asking linesOf, cuesOf and choicesOf per node walks
// every record 500 times (millions of steps on each change). Trade-off: three maps are
// built on every call even when the chapter has few nodes.
function groupByNode<T>(records: T[], nodeOf: (r: T) => string, nodeIds: Set<string>): Map<string, T[]> {
  const byNode = new Map<string, T[]>()
  for (const r of records) {
    const id = nodeOf(r)
    if (!nodeIds.has(id)) continue
    const list = byNode.get(id)
    if (list === undefined) byNode.set(id, [r])
    else list.push(r)
  }
  return byNode
}

// Both ends of a connection; liveConnections only returns connections whose ends exist.
function ends(s: ContentState, c: LinkedConnection): { from: StoryNode; to: StoryNode } | null {
  const from = s.nodes[c.fromNodeId]
  const to = s.nodes[c.toNodeId]
  return from === undefined || to === undefined ? null : { from, to }
}

const crossLinkText = (s: ContentState, to: StoryNode): string =>
  `→ ${s.chapters[to.chapterId]?.title ?? ''}: ${to.title || 'Untitled'}`

function crossLinksByNode(s: ContentState, chapterId: string): Map<string, CrossLink[]> {
  const byNode = new Map<string, CrossLink[]>()
  for (const c of liveConnections(s)) {
    const e = ends(s, c)
    if (e === null || e.from.chapterId !== chapterId || e.to.chapterId === chapterId) continue
    const { from, to } = e
    const link = { connectionId: c.id, targetNodeId: to.id, targetChapterId: to.chapterId, text: crossLinkText(s, to) }
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

function cardChoice(s: ContentState, c: Connection, chapterId: string): CardChoice | null {
  const target = c.toNodeId === null ? undefined : s.nodes[c.toNodeId]
  if (c.toNodeId !== null && (target === undefined || !isLiveNode(s, target.id))) return null
  const crossLink =
    target === undefined || target.chapterId === chapterId
      ? null
      : {
          connectionId: c.id,
          targetNodeId: target.id,
          targetChapterId: target.chapterId,
          text: crossLinkText(s, target),
        }
  return { id: c.id, text: c.label || 'Untitled', untitled: c.label === '', linked: c.toNodeId !== null, crossLink }
}

function cardChoices(s: ContentState, list: Connection[], chapterId: string): CardChoice[] {
  return list.sort(byCreated).flatMap((c) => cardChoice(s, c, chapterId) ?? [])
}

/** One React Flow node (type `card`) per live node in the chapter. */
export function toFlowNodes(s: ContentState, chapterId: string, markers: Map<string, NodeMarker>): CardNode[] {
  const nodes = liveNodes(s, chapterId)
  const ids = new Set(nodes.map((n) => n.id))
  const lines = groupByNode(Object.values(s.lines), (l) => l.nodeId, ids)
  const cues = groupByNode(Object.values(s.cues), (q) => q.nodeId, ids)
  const choices = groupByNode(Object.values(s.connections), (c) => c.fromNodeId, ids)
  return nodes.map((n) => {
    const own = (lines.get(n.id) ?? []).sort(byOrder)
    const ownCues = (cues.get(n.id) ?? []).sort(byOrder)
    const data: NodeCardData = {
      title: n.title,
      color: n.color,
      preview: own.slice(0, PREVIEW_LINES).map(previewOf),
      more: Math.max(0, own.length - PREVIEW_LINES),
      marker: markers.get(n.id) ?? NO_MARKER,
      choices: cardChoices(s, choices.get(n.id) ?? [], chapterId),
      cues: ownCues.slice(0, CUE_LINES).map((q) => ({ tag: CUE_TAG[q.type], text: q.text })),
      moreCues: Math.max(0, ownCues.length - CUE_LINES),
      coverMediaId: n.coverMediaId,
    }
    // A size of 0 is the default: the default width, and a height that follows the content.
    return {
      id: n.id,
      type: 'card',
      position: { x: n.x, y: n.y },
      width: n.width > 0 ? n.width : DEFAULT_CARD_WIDTH,
      height: n.height > 0 ? n.height : undefined,
      data,
    }
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
    .map((c) => ({
      id: c.id,
      source: c.fromNodeId,
      target: c.toNodeId,
      label: c.label,
      sourceHandle: choiceHandleId(c.id),
    }))
}
