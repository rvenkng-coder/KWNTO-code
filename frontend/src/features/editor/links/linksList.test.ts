import { describe, expect, test } from 'vitest'
import type { LinkEvent, NodeLink } from '../../../backend/link-types.ts'
import { applyLinkEvent, linksOf } from './linksList.ts'

function link(id: string, nodeId: string, created: string): NodeLink {
  return { id, projectId: 'p', nodeId, creatorId: 'u', title: id, url: `https://${id}.example`, created }
}

describe('linksOf', () => {
  // Protects: a node shows only its own links, oldest first (C1)
  test("a node's links come oldest first", () => {
    const links = [link('c', 'n1', '2026-11-21 10:00:03Z'), link('x', 'n2', '2026-11-21 10:00:01Z'), link('a', 'n1', '2026-11-21 10:00:01Z'), link('b', 'n1', '2026-11-21 10:00:02Z')]
    expect(linksOf(links, 'n1').map((l) => l.id)).toEqual(['a', 'b', 'c'])
    expect(linksOf(links, 'none')).toEqual([])
  })
})

describe('applyLinkEvent', () => {
  // Protects: a live event and the answer to our own add can both arrive; neither duplicates or mutates (C2)
  test('link events never duplicate or mutate', () => {
    const a = link('a', 'n1', '2026-11-21 10:00:01Z')
    const empty: NodeLink[] = []
    const create: LinkEvent = { action: 'create', record: a }
    const once = applyLinkEvent(empty, create)
    const twice = applyLinkEvent(once, create)
    expect(once).toEqual([a])
    expect(twice).toEqual([a])
    expect(empty).toEqual([])

    const del: LinkEvent = { action: 'delete', record: a }
    const gone = applyLinkEvent(twice, del)
    expect(gone).toEqual([])
    expect(applyLinkEvent(gone, del)).toEqual([])
    expect(twice).toEqual([a])
  })
})
