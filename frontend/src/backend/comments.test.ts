import PocketBase from 'pocketbase'
import { afterEach, expect, test, vi } from 'vitest'
import { createComments, toComment } from './comments.ts'

afterEach(() => {
  vi.unstubAllGlobals()
})

// Protects D13: the door maps a stored record to the screen's Comment, an author who left
// (empty `author`) has no id, and a list is asked for oldest first.
test('the door maps records and lists oldest first', async () => {
  expect(toComment({ id: 'c1', project: 'p', node: 'n', author: '', author_name: 'Mara', body: 'Hi', created: '2026-11-20 10:00:00.000Z' }))
    .toEqual({ id: 'c1', projectId: 'p', nodeId: 'n', authorId: null, authorName: 'Mara', body: 'Hi', created: '2026-11-20 10:00:00.000Z' })

  const fetchMock = vi.fn(async () => new Response(JSON.stringify({ page: 1, perPage: 500, totalItems: 0, totalPages: 0, items: [] }), { status: 200, headers: { 'content-type': 'application/json' } }))
  vi.stubGlobal('fetch', fetchMock)
  await createComments(new PocketBase('http://pb.test')).list('p1')
  const url = decodeURIComponent((fetchMock.mock.calls[0] as unknown as [string])[0])
  expect(url).toContain('/api/collections/comments/records')
  expect(url).toContain('sort=created,id')
})
