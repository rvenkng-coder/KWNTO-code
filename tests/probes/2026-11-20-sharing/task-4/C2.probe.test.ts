import PocketBase from 'pocketbase'
import { afterEach, expect, test, vi } from 'vitest'
import { createShares } from '../../../../frontend/src/backend/shares'

afterEach(() => vi.unstubAllGlobals())

function answer(status: number, message: string): Response {
  return new Response(JSON.stringify({ status, message, data: {} }), { status, headers: { 'content-type': 'application/json' } })
}

// Protects: probe of plan row C2, each link refusal maps to its own error kind with the server's copy.
test('[C2] equivalence: 401 and 403 are forbidden, 404 is not-found, each keeps its own message', async () => {
  const fetchMock = vi.fn()
  vi.stubGlobal('fetch', fetchMock)
  const shares = createShares(new PocketBase('http://pb.test'))
  const cases: Array<[number, string, string]> = [
    [401, 'Sign in to open this shared project.', 'forbidden'],
    [403, 'Verify your email to open this shared project.', 'forbidden'],
    [404, 'This link is not valid or was revoked.', 'not-found'],
  ]
  for (const [status, message, kind] of cases) {
    fetchMock.mockResolvedValueOnce(answer(status, message))
    await expect(shares.open('T')).rejects.toMatchObject({ kind, message })
  }
})

// Protects: probe of plan row C2, the token is a path segment and is escaped, never pasted as typed.
test('[C2] injection: a token with path or query characters is sent as one escaped segment', async () => {
  const fetchMock = vi.fn().mockResolvedValue(answer(404, 'This link is not valid or was revoked.'))
  vi.stubGlobal('fetch', fetchMock)
  const shares = createShares(new PocketBase('http://pb.test'))
  await shares.open("a/../b?x=1' OR 1=1 --").catch(() => undefined)
  const url = String(fetchMock.mock.calls[0]?.[0])
  expect(url.startsWith('http://pb.test/api/kwnto/share/')).toBe(true)
  expect(url).not.toContain('/../')
  expect(url).not.toContain('?x=1')
  expect(shares.mediaUrl('a/b', 'm?1')).not.toContain('a/b/media')
})

// Protects: probe of plan row C2, an unreachable server is not shown as "bad link".
test('[C2] failure: a network error is not reported as not-found', async () => {
  vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new TypeError('Failed to fetch')))
  const shares = createShares(new PocketBase('http://pb.test'))
  const error = await shares.open('T').then(() => null, (e: unknown) => e as { kind?: string })
  expect(error).not.toBeNull()
  expect(error?.kind).not.toBe('not-found')
})
