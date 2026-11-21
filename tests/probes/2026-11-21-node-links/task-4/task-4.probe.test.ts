import { expect, test } from 'vitest'
import type { NodeLink } from '../../../../frontend/src/backend/link-types.ts'
import { applyLinkEvent, linksOf } from '../../../../frontend/src/features/editor/links/linksList.ts'

// Written by the author after the code (native execution): weaker than sealed probes; the final
// whole-branch review covers the gap.

function link(id: string, nodeId: string, created: string): NodeLink {
  return { id, projectId: 'p', nodeId, creatorId: 'u', title: id, url: 'https://a.example', created }
}

// Protects: linksOf never reorders or mutates the caller's array.
test('[C1] boundary-inputs: linksOf leaves its input untouched and handles an empty list', () => {
  const input = [link('b', 'n', '2026-11-21 10:00:02Z'), link('a', 'n', '2026-11-21 10:00:01Z')]
  const snapshot = input.map((l) => l.id)
  expect(linksOf(input, 'n').map((l) => l.id)).toEqual(['a', 'b'])
  expect(input.map((l) => l.id)).toEqual(snapshot)
  expect(linksOf([], 'n')).toEqual([])
})

// Protects: deleting an unknown id and creating a second link on the same node keep the rest intact.
test('[C2] error-paths: deleting an unknown id changes nothing and other links survive a delete', () => {
  const a = link('a', 'n', '2026-11-21 10:00:01Z')
  const b = link('b', 'n', '2026-11-21 10:00:02Z')
  expect(applyLinkEvent([a, b], { action: 'delete', record: link('zzz', 'n', '') })).toEqual([a, b])
  expect(applyLinkEvent([a, b], { action: 'delete', record: a })).toEqual([b])
  expect(applyLinkEvent([a], { action: 'create', record: b })).toEqual([a, b])
})
