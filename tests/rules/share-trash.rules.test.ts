import { expect, test } from 'vitest'
import { createNode, guardedUpdate, memberProject, readAsAdmin, type MemberProject } from './helpers/content.ts'
import { asUser, createUser, type TestUser } from './helpers/pb.ts'
import { createLink, joinShare } from './helpers/share.ts'

// Review finding M1 of plan 2026-11-20-sharing (design 6.8: a trashed project is hidden with
// its contents): a person who already joined an edit or comment link loses the project while
// it is in the trash and gets it back when the owner restores it. Without this, a leaked
// link keeps working for the whole retention period.

async function holder(ctx: MemberProject, permission: 'comment' | 'edit'): Promise<TestUser> {
  const user = await createUser()
  const link = await createLink(ctx.member, ctx.projectId, permission, 'live')
  expect((await joinShare(link.token, user)).status).toBe(200)
  return user
}

async function setTrashed(ctx: MemberProject, deletedAt: string): Promise<void> {
  const version = Number((await readAsAdmin('projects', ctx.projectId)).version)
  expect((await guardedUpdate(ctx.owner, 'projects', ctx.projectId, { deleted_at: deletedAt, version })).status).toBe(200)
}

async function count(user: TestUser, collection: string, projectId: string): Promise<number> {
  const rows = await (await asUser(user)).collection(collection).getFullList()
  return rows.filter((row) => (collection === 'projects' ? row.id : row.project) === projectId).length
}

async function rename(user: TestUser, nodeId: string, title: string): Promise<number> {
  const version = Number((await readAsAdmin('nodes', nodeId)).version)
  return (await guardedUpdate(user, 'nodes', nodeId, { title, version })).status
}

// Protects M1: while the project is in the trash an edit-link holder cannot read or edit it
// and a comment-link holder cannot read or post comments; their grant rows are hidden too
// (so "Shared with me" drops it); after the restore everything works again.
test('link holders lose a trashed project and get it back on restore', async () => {
  const ctx = await memberProject()
  const nodeId = await createNode(ctx.member, ctx.projectId, ctx.chapterId, { title: 'start' })
  const editor = await holder(ctx, 'edit')
  const commenter = await holder(ctx, 'comment')
  await (await asUser(commenter)).collection('comments').create({ project: ctx.projectId, node: nodeId, author: commenter.id, body: 'before' })

  expect(await count(editor, 'projects', ctx.projectId)).toBe(1)
  expect(await count(editor, 'link_grants', ctx.projectId)).toBe(1)

  await setTrashed(ctx, '2026-11-21 10:00:00.000Z')
  expect(await count(editor, 'projects', ctx.projectId)).toBe(0)
  expect(await count(editor, 'nodes', ctx.projectId)).toBe(0)
  expect(await count(editor, 'link_grants', ctx.projectId)).toBe(0)
  expect(await rename(editor, nodeId, 'while trashed')).toBe(404)
  expect(await count(commenter, 'comments', ctx.projectId)).toBe(0)
  expect(await count(commenter, 'link_grants', ctx.projectId)).toBe(0)
  await expect(
    (await asUser(commenter)).collection('comments').create({ project: ctx.projectId, node: nodeId, author: commenter.id, body: 'while trashed' }),
  ).rejects.toMatchObject({ status: 400 })
  expect(await count(ctx.member, 'nodes', ctx.projectId)).toBeGreaterThan(0)

  await setTrashed(ctx, '')
  expect(await count(editor, 'projects', ctx.projectId)).toBe(1)
  expect(await rename(editor, nodeId, 'after restore')).toBe(200)
  expect(await count(commenter, 'comments', ctx.projectId)).toBe(1)
  expect(await count(editor, 'link_grants', ctx.projectId)).toBe(1)
})
