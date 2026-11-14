import { expect, test } from 'vitest'
import { parseRoute, routeToHash } from '../../../../frontend/src/features/shell/routes'

// Probe for C7: round trip.
// Protects: the exact hash text of each route shape.
test('[C7] relative-of-fixed-case: the exact hash text of each route shape', () => {
  expect(routeToHash({ name: 'teams' })).toBe('#/')
  expect(routeToHash({ name: 'team', teamId: 'abcdefghijk0123' })).toBe('#/team/abcdefghijk0123')
  expect(routeToHash({ name: 'project', projectId: 'abcdefghijk0123', chapterId: null })).toBe('#/project/abcdefghijk0123')
  expect(routeToHash({ name: 'project', projectId: 'abcdefghijk0123', chapterId: 'zyxwvutsrq98765' })).toBe('#/project/abcdefghijk0123/chapter/zyxwvutsrq98765')
})

// Protects: every hash parseRoute accepts survives a round trip unchanged.
test('[C7] helper-hides-bug: every hash parseRoute accepts survives a round trip unchanged', () => {
  for (const h of ['#/team/abcdefghijk0123', '#/project/zyxwvutsrq98765', '#/project/abcdefghijk0123/chapter/zyxwvutsrq98765', '#/team/abcdefghijk0123/', '#/project/abcdefghijk0123/chapter/zyxwvutsrq98765/']) {
    const r = parseRoute(h)
    expect(parseRoute(routeToHash(r)), h).toEqual(r)
  }
})

// Protects: parseRoute never throws on odd input.
test('[C7] empty-one-huge: parseRoute never throws on odd input', () => {
  for (const h of ['#%', '#/%E0%A4%A', '#/\u0000', '#/team/\u0000', '#\ud800']) {
    expect(() => parseRoute(h), h).not.toThrow()
  }
})
