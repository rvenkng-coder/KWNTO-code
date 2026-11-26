import { afterEach, expect, test } from 'vitest'
import { createNode, guardedUpdate, memberProject, readAsAdmin } from './helpers/content.ts'
import { deleteAllMedia, PNG_1PX, uploadMedia } from './helpers/media.ts'
import { asAdmin, asUser, createUser } from './helpers/pb.ts'
import { createLink, joinShare, revokeLink, shareMedia } from './helpers/share.ts'

// Media made here must not outlive the file: other rule files count the whole table.
afterEach(deleteAllMedia)

// Protects access that ends: who may still touch a project after a link is revoked or its content
// is trashed.

async function trash(
  user: Parameters<typeof guardedUpdate>[0],
  collection: string,
  id: string,
  deletedAt: string,
): Promise<number> {
  const version = Number((await readAsAdmin(collection, id)).version)
  return (await guardedUpdate(user, collection, id, { deleted_at: deletedAt, version })).status
}

// Protects revocation: a holder whose edit link was revoked can no longer refresh or move their presence row.
test('a revoked edit link holder cannot keep updating their presence row', async () => {
  const ctx = await memberProject()
  const nodeId = await createNode(ctx.member, ctx.projectId, ctx.chapterId, { title: 'a' })
  const other = await createNode(ctx.member, ctx.projectId, ctx.chapterId, { title: 'b' })
  const holder = await createUser()
  const link = await createLink(ctx.member, ctx.projectId, 'edit', 'live')
  expect((await joinShare(link.token, holder)).status).toBe(200)
  const pb = await asUser(holder)
  const row = await pb
    .collection('presence')
    .create({ project: ctx.projectId, node: nodeId, user: holder.id, field: 'title', beat: 0 })
  await pb.collection('presence').update(row.id, { beat: 1 })

  await revokeLink(ctx.member, link.id)
  await expect(pb.collection('presence').update(row.id, { beat: 2 })).rejects.toMatchObject({ status: 404 })
  await expect(pb.collection('presence').update(row.id, { node: other })).rejects.toMatchObject({ status: 404 })
})

// Protects trashed content: a live link hides the media of a trashed node or chapter, as the file does, and a snapshot
// keeps what it listed.
test('a live link does not serve media of a trashed node or chapter', async () => {
  const { member, owner, projectId, chapterId } = await memberProject()
  const nodeId = await createNode(member, projectId, chapterId, { title: 'pic' })
  const mediaId = (
    (await (
      await uploadMedia(member, { project: projectId, node: nodeId }, { name: 'pic.png', bytes: PNG_1PX })
    ).json()) as { id: string }
  ).id
  const live = await createLink(member, projectId, 'view', 'live')
  const snap = await createLink(member, projectId, 'view', 'snapshot')
  expect((await shareMedia(live.token, mediaId)).status).toBe(200)

  expect(await trash(member, 'nodes', nodeId, '2026-11-21 10:00:00.000Z')).toBe(200)
  expect((await shareMedia(live.token, mediaId)).status).toBe(404)
  expect((await shareMedia(snap.token, mediaId)).status).toBe(200)

  expect(await trash(member, 'nodes', nodeId, '')).toBe(200)
  expect((await shareMedia(live.token, mediaId)).status).toBe(200)
  expect(await trash(owner, 'chapters', chapterId, '2026-11-21 10:00:00.000Z')).toBe(200)
  expect((await shareMedia(live.token, mediaId)).status).toBe(404)
})

// Protects restore order: the server refuses to restore a node while its chapter is in the trash (the panel says so
// too), and allows it after.
test('a node of a trashed chapter cannot be restored before its chapter', async () => {
  const { member, owner, projectId, chapterId } = await memberProject()
  const nodeId = await createNode(member, projectId, chapterId, { title: 'inside' })
  expect(await trash(member, 'nodes', nodeId, '2026-11-21 10:00:00.000Z')).toBe(200)
  expect(await trash(owner, 'chapters', chapterId, '2026-11-21 10:00:00.000Z')).toBe(200)

  expect(await trash(member, 'nodes', nodeId, '')).toBe(400)
  expect(String((await readAsAdmin('nodes', nodeId)).deleted_at)).not.toBe('')

  expect(await trash(owner, 'chapters', chapterId, '')).toBe(200)
  expect(await trash(member, 'nodes', nodeId, '')).toBe(200)
})

// Protects: a project whose file would not fit the 6 MB snapshot field gets a clear
// message instead of a bare 400, and a live link of the same project still works.
test('a snapshot of a project over 6 MB says so, and a live link still works', { timeout: 120_000 }, async () => {
  const { member, projectId, chapterId } = await memberProject()
  const nodeId = await createNode(member, projectId, chapterId, { title: 'big' })
  const admin = await asAdmin()
  const text = 'x'.repeat(5000)
  for (let start = 0; start < 1400; start += 100) {
    await Promise.all(
      Array.from({ length: 100 }, (_, i) =>
        admin
          .collection('script_lines')
          .create(
            { project: projectId, node: nodeId, character: 'Mara', text, sort_order: start + i },
            { requestKey: null },
          ),
      ),
    )
  }
  const pb = await asUser(member)
  await expect(
    pb
      .collection('share_links')
      .create({ project: projectId, created_by: member.id, permission: 'view', kind: 'snapshot' }),
  ).rejects.toMatchObject({ response: { message: expect.stringContaining('too large for a snapshot') } })
  await pb
    .collection('share_links')
    .create({ project: projectId, created_by: member.id, permission: 'view', kind: 'live' })
})
