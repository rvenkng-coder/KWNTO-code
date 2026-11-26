import { expect, test } from 'vitest'
import { createNode, memberProject, type MemberProject } from './helpers/content.ts'
import { asAdmin, asAnonymous, asUser, createUser, type TestUser } from './helpers/pb.ts'
import { createLink, joinShare } from './helpers/share.ts'

// Rules of `presence` (design 5): one row per person and project saying which node and field they
// are editing. Team members and edit-link holders write their own row; nobody writes another
// person's; old rows are removed by a job.

async function failure(promise: Promise<unknown>): Promise<number> {
  try {
    await promise
    return 200
  } catch (error) {
    return (error as { status?: number }).status ?? 0
  }
}

async function mark(user: TestUser | null, ctx: MemberProject, nodeId: string, extra: Record<string, unknown> = {}) {
  const pb = user === null ? asAnonymous() : await asUser(user)
  return pb
    .collection('presence')
    .create({ project: ctx.projectId, node: nodeId, user: user?.id ?? '', field: 'title', beat: 0, ...extra })
}

async function holder(ctx: MemberProject, permission: 'comment' | 'edit'): Promise<TestUser> {
  const user = await createUser()
  const link = await createLink(ctx.member, ctx.projectId, permission, 'live')
  expect((await joinShare(link.token, user)).status).toBe(200)
  return user
}

// Protects presence writes: people mark only themselves, in a project they may edit (a team member or
// an edit-link holder; a comment-link holder may not); one row per person and project; the
// name is the server's; nobody changes or removes another person's row.
test('people mark only themselves as editing, in a project they may edit', async () => {
  const ctx = await memberProject()
  const nodeId = await createNode(ctx.member, ctx.projectId, ctx.chapterId)
  const other = await memberProject()
  const otherNode = await createNode(other.member, other.projectId, other.chapterId)
  const admin = await asAdmin()
  await admin.collection('users').update(ctx.member.id, { name: 'Mara' })

  const row = await mark(ctx.member, ctx, nodeId)
  expect(row.user_name).toBe('Mara')
  const pb = await asUser(ctx.member)
  const beat = await pb.collection('presence').update(row.id, { beat: 1, field: 'line' })
  expect([beat.beat, beat.field, beat.user_name]).toEqual([1, 'line', 'Mara'])
  expect(await failure(mark(ctx.member, ctx, nodeId))).toBeGreaterThanOrEqual(400)

  const mate = await createUser()
  const refused: (() => Promise<unknown>)[] = [
    () => mark(ctx.owner, ctx, nodeId, { user: ctx.member.id }),
    () => mark(ctx.owner, ctx, nodeId, { user_name: 'Boss' }),
    () => mark(ctx.owner, ctx, otherNode),
    () => mark(mate, ctx, nodeId),
    () => mark(null, ctx, nodeId),
    async () => mark(await holder(ctx, 'comment'), ctx, nodeId),
  ]
  for (const attempt of refused) expect([400, 403, 404]).toContain(await failure(attempt()))

  const editor = await holder(ctx, 'edit')
  expect((await mark(editor, ctx, nodeId)).user).toBe(editor.id)

  const ownersRow = await mark(ctx.owner, ctx, nodeId)
  expect(await failure(pb.collection('presence').update(ownersRow.id, { field: 'x' }))).toBe(404)
  expect(await failure(pb.collection('presence').update(row.id, { user: ctx.owner.id }))).toBe(404)
  expect(await failure(pb.collection('presence').update(row.id, { node: otherNode }))).toBe(404)
  expect(await failure(pb.collection('presence').delete(ownersRow.id))).toBe(404)
  await pb.collection('presence').delete(row.id)
})

// Protects presence reads and the purge: a teammate's row reaches an open subscription with the name, an outsider sees
// none, and the job removes a row not refreshed for twice the timeout and nothing fresher.
test('presence is seen by the team and old rows are removed', async () => {
  const ctx = await memberProject()
  const nodeId = await createNode(ctx.member, ctx.projectId, ctx.chapterId)
  const admin = await asAdmin()
  const settings = await admin.collection('system_behavior').getFirstListItem('')
  const timeout = settings.presence_timeout_seconds as number
  try {
    await admin.collection('system_behavior').update(settings.id, { presence_timeout_seconds: 1 })
    const watcher = await asUser(ctx.owner)
    const names: string[] = []
    await watcher.collection('presence').subscribe('*', (e) => names.push(String(e.record.user_name)))
    const old = await mark(ctx.member, ctx, nodeId)
    await expect.poll(() => names.length, { timeout: 4000 }).toBeGreaterThan(0)
    expect(await (await asUser(await createUser())).collection('presence').getFullList()).toEqual([])
    await watcher.collection('presence').unsubscribe('*')

    await new Promise((resolve) => setTimeout(resolve, 2500))
    const fresh = await mark(ctx.owner, ctx, nodeId)
    await admin.crons.run('purge_presence')
    await expect
      .poll(
        async () =>
          (await admin.collection('presence').getFullList({ filter: admin.filter('id = {:id}', { id: old.id }) }))
            .length,
        { timeout: 6000 },
      )
      .toBe(0)
    expect((await admin.collection('presence').getOne(fresh.id)).id).toBe(fresh.id)
  } finally {
    await admin.collection('system_behavior').update(settings.id, { presence_timeout_seconds: timeout })
  }
})
