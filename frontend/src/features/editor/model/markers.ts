import { isLiveNode, liveConnections, liveNodes, type ContentState } from './state'

// Start, end and unreachable markers (design 6.1), over all chapters.

export interface NodeMarker {
  isStart: boolean
  isEnd: boolean
  isUnreachable: boolean
}

/** The project's start node when that node is live; a trashed or missing start node means no start. */
export function effectiveStart(s: ContentState): string | null {
  const id = s.project?.startNodeId ?? null
  return id !== null && isLiveNode(s, id) ? id : null
}

/**
 * One entry per live node. End: no connection from it to a live node (a self-link counts as
 * outgoing). Unreachable: no connection into it from a live node other than itself, and it is
 * not the start node.
 */
export function nodeMarkers(s: ContentState): Map<string, NodeMarker> {
  const start = effectiveStart(s)
  const withOutgoing = new Set<string>()
  const withIncoming = new Set<string>()
  // liveConnections keeps only connections whose two ends are live.
  for (const c of liveConnections(s)) {
    withOutgoing.add(c.fromNodeId)
    if (c.fromNodeId !== c.toNodeId) withIncoming.add(c.toNodeId)
  }
  const markers = new Map<string, NodeMarker>()
  for (const { id } of liveNodes(s)) {
    const hasIncoming = withIncoming.has(id)
    markers.set(id, {
      isStart: id === start,
      isEnd: !withOutgoing.has(id),
      isUnreachable: !hasIncoming && id !== start,
    })
  }
  return markers
}
