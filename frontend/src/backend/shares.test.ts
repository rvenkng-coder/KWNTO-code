import PocketBase from 'pocketbase'
import { afterEach, expect, test, vi } from 'vitest'
import { createShares } from './shares.ts'

afterEach(() => {
  vi.unstubAllGlobals()
})

function failure(status: number, message: string): Response {
  return new Response(JSON.stringify({ status, message, data: {} }), {
    status,
    headers: { 'content-type': 'application/json' },
  })
}

// Protects the link messages: the door hands the server's exact text on, and a sign-in or verification problem is
// `forbidden` while a bad link is `not-found`.
test("the door passes the server's link messages on", async () => {
  const fetchMock = vi.fn()
  vi.stubGlobal('fetch', fetchMock)
  const shares = createShares(new PocketBase('http://pb.test'))

  fetchMock.mockResolvedValueOnce(failure(401, 'Sign in to open this shared project.'))
  await expect(shares.open('T')).rejects.toMatchObject({
    kind: 'forbidden',
    message: 'Sign in to open this shared project.',
  })
  fetchMock.mockResolvedValueOnce(failure(403, 'Verify your email to open this shared project.'))
  await expect(shares.open('T')).rejects.toMatchObject({
    kind: 'forbidden',
    message: 'Verify your email to open this shared project.',
  })
  fetchMock.mockResolvedValueOnce(failure(404, 'This link is not valid or was revoked.'))
  await expect(shares.open('T')).rejects.toMatchObject({
    kind: 'not-found',
    message: 'This link is not valid or was revoked.',
  })

  expect(shares.mediaUrl('T', 'm1')).toBe('http://pb.test/api/kwnto/share/T/media/m1')
  expect(shares.mediaUrl('T', 'm1', true)).toBe('http://pb.test/api/kwnto/share/T/media/m1?thumb=100x100')
})

// Protects: two edit links of one project list the project once, newest first.
test('myGrants lists a project once even with two grants', async () => {
  const rows = [
    { project: 'p1', project_name: 'Story', permission: 'edit' },
    { project: 'p2', project_name: 'Other', permission: 'edit' },
    { project: 'p1', project_name: 'Story', permission: 'edit' },
  ]
  const pb = { collection: () => ({ getFullList: () => Promise.resolve(rows) }) } as unknown as PocketBase
  expect((await createShares(pb).myGrants()).map((g) => g.projectId)).toEqual(['p1', 'p2'])
})
