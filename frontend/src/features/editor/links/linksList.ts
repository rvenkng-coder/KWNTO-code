import type { LinkEvent, NodeLink } from '../../../backend/link-types.ts'

// One node's links, oldest first.
export function linksOf(links: NodeLink[], nodeId: string): NodeLink[] {
  return links
    .filter((l) => l.nodeId === nodeId)
    .sort((a, b) => (a.created < b.created ? -1 : a.created > b.created ? 1 : 0))
}

// A live event and the answer to our own request can both arrive, so a create is ignored when the id
// is already there and a delete of something already gone changes nothing. Returns a new array.
export function applyLinkEvent(links: NodeLink[], event: LinkEvent): NodeLink[] {
  if (event.action === 'delete') return links.filter((l) => l.id !== event.record.id)
  return links.some((l) => l.id === event.record.id) ? [...links] : [...links, event.record]
}
