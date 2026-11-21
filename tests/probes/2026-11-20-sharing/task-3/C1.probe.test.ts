import { createRequire } from 'node:module'
import { expect, test } from 'vitest'

const require = createRequire(import.meta.url)
const { shareAccess, snapshotMediaIds } = require('../../../../backend/pb_hooks/lib/share.js') as {
  shareAccess: (link: unknown, trashed: boolean, caller: { signedIn: boolean; verified: boolean }) => { status: number; mode: string | null }
  snapshotMediaIds: (data: unknown) => string[]
}
const OUT = { signedIn: false, verified: false }
const IN_UNVERIFIED = { signedIn: true, verified: false }
const IN = { signedIn: true, verified: true }
const link = (permission: string, extra: object = {}) => ({ revoked: false, permission, kind: 'live', ...extra })

// Protects: probe of plan row C1, no oracle: a missing, revoked or trashed link is the same answer whoever asks.
test('[C1] equivalence: missing, revoked and trashed are one 404 for every caller, even a verified one', () => {
  const same = { status: 404, mode: null }
  for (const caller of [OUT, IN_UNVERIFIED, IN]) {
    expect(shareAccess(null, false, caller)).toEqual(same)
    for (const permission of ['view', 'comment', 'edit']) {
      expect(shareAccess(link(permission, { revoked: true }), false, caller)).toEqual(same)
      expect(shareAccess(link(permission), true, caller)).toEqual(same)
    }
  }
})

// Protects: probe of plan row C1, the sign-in ladder: 401, then 403, then in; a view link needs none.
test('[C1] boundary: view needs nobody; comment and edit need sign-in (401) then verification (403)', () => {
  expect(shareAccess(link('view'), false, OUT)).toEqual({ status: 200, mode: 'view' })
  expect(shareAccess(link('view', { kind: 'snapshot' }), false, OUT)).toEqual({ status: 200, mode: 'view' })
  for (const permission of ['comment', 'edit']) {
    expect(shareAccess(link(permission), false, OUT).status).toBe(401)
    expect(shareAccess(link(permission), false, IN_UNVERIFIED).status).toBe(403)
    expect(shareAccess(link(permission), false, IN)).toEqual({ status: 200, mode: permission })
  }
})

// Protects: probe of plan row C1, a revoked link gives the 404 before it can say 401 or 403 (a signed-out person learns nothing).
test('[C1] stale-after-change: a revoked comment link answers 404, not 401, to a signed-out caller', () => {
  expect(shareAccess(link('comment', { revoked: true }), false, OUT).status).toBe(404)
  expect(shareAccess(link('edit'), true, OUT).status).toBe(404)
})

// Protects: probe of plan row C1, a stored snapshot that is malformed opens no media.
test('[C1] malformed: snapshotMediaIds reads only entries with a string id', () => {
  expect(snapshotMediaIds({ media: [{ id: 'a' }, { id: 'b' }] })).toEqual(['a', 'b'])
  expect(snapshotMediaIds(null)).toEqual([])
  expect(snapshotMediaIds(undefined)).toEqual([])
  expect(snapshotMediaIds({ media: 'x' })).toEqual([])
  expect(snapshotMediaIds('{"media":[{"id":"a"}]}')).toEqual([])
  expect(snapshotMediaIds({ media: [{ id: 'a' }, null, 5, { id: 7 }, {}, 'a'] })).toEqual(['a'])
  expect(snapshotMediaIds({})).toEqual([])
})
