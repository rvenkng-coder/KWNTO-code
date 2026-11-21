import { createRequire } from 'node:module'
import { expect, test } from 'vitest'

// The hook helpers are CommonJS so PocketBase can require() them; load them the same way.
const require = createRequire(import.meta.url)
type Link = { revoked: boolean; permission: 'view' | 'comment' | 'edit'; kind: 'live' | 'snapshot' }
type Caller = { signedIn: boolean; verified: boolean }
type Decision = { status: number; mode: string | null }
const { shareAccess, snapshotMediaIds } = require('../../backend/pb_hooks/lib/share.js') as {
  shareAccess: (link: Link | null, projectTrashed: boolean, caller: Caller) => Decision
  snapshotMediaIds: (snapshotData: unknown) => string[]
}

const OUT: Caller = { signedIn: false, verified: false }
const UNVERIFIED: Caller = { signedIn: true, verified: false }
const VERIFIED: Caller = { signedIn: true, verified: true }
const link = (permission: Link['permission'], revoked = false): Link => ({ revoked, permission, kind: 'live' })
const NOT_FOUND = { status: 404, mode: null }

// Protects design 5 and security.md 2 (Review Focus 1): a missing or revoked link or a
// trashed project is the same 404 for everyone; a view link opens for anyone; comment and
// edit links need a signed-in (401) and verified (403) caller; the media ids of a snapshot
// are read only from a well-formed `media` list.
test('who gets in through a link is decided by the link, the project and the caller', () => {
  expect(shareAccess(null, false, VERIFIED)).toEqual(NOT_FOUND)
  expect(shareAccess(link('view', true), false, OUT)).toEqual(NOT_FOUND)
  expect(shareAccess(link('view'), true, OUT)).toEqual(NOT_FOUND)
  expect(shareAccess(link('view'), false, OUT)).toEqual({ status: 200, mode: 'view' })

  for (const permission of ['comment', 'edit'] as const) {
    expect(shareAccess(link(permission), false, OUT)).toEqual({ status: 401, mode: null })
    expect(shareAccess(link(permission), false, UNVERIFIED)).toEqual({ status: 403, mode: null })
    expect(shareAccess(link(permission), false, VERIFIED)).toEqual({ status: 200, mode: permission })
  }

  expect(snapshotMediaIds({ media: [{ id: 'a' }, { id: 'b' }] })).toEqual(['a', 'b'])
  expect(snapshotMediaIds(null)).toEqual([])
  expect(snapshotMediaIds({ media: 'x' })).toEqual([])
})
