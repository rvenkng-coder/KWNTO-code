import { expect, test } from 'vitest'
import { createNode, guardedUpdate, memberProject, readAsAdmin, type MemberProject } from './helpers/content.ts'
import { setVerified, unverifiedUser } from './helpers/invites.ts'
import { asAdmin, asAnonymous, asUser, createUser, type TestUser } from './helpers/pb.ts'
import { createLink, joinShare, revokeLink } from './helpers/share.ts'
import { addMember } from './helpers/teams.ts'

// Rules of `comments` (design 5; plan 2026-11-20-sharing Task 5, D8 and D13): team members
// and holders of comment and edit links read and write; the server copies the author's name;
// nobody edits a comment; the author or the team owner deletes it.

async function failure(promise: Promise<unknown>): Promise<number> {
  try {
    await promise
    return 200
  } catch (error) {
    return (error as { status?: number }).status ?? 0
  }
}

async function post(user: TestUser | null, ctx: MemberProject, nodeId: string, body: string, extra: Record<string, unknown> = {}) {
  const pb = user === null ? asAnonymous() : await asUser(user)
  return pb.collection('comments').create({ project: ctx.projectId, node: nodeId, author: user?.id ?? '', body, ...extra })
}

async function countOf(projectId: string): Promise<number> {
  const admin = await asAdmin()
  return (await admin.collection('comments').getFullList({ filter: admin.filter('project = {:p}', { p: projectId }) })).length
}

async function holder(ctx: MemberProject, permission: 'comment' | 'edit'): Promise<{ user: TestUser; linkId: string }> {
  const user = await createUser()
  const link = await createLink(ctx.member, ctx.projectId, permission, 'live')
  expect((await joinShare(link.token, user)).status).toBe(200)
  return { user, linkId: link.id }
}

async function seen(user: TestUser | null, projectId: string): Promise<number> {
  if (user === null) return (await asAnonymous().collection('comments').getFullList()).filter((c) => c.project === projectId).length
  return (await (await asUser(user)).collection('comments').getFullList()).filter((c) => c.project === projectId).length
}

// Protects D8: the team and comment and edit link holders read a project's comments; an
// outsider, a signed-out caller, a view-link visitor and a holder of a revoked link do not.
test('comments are read by the team and by comment and edit link holders', async () => {
  const ctx = await memberProject()
  const nodeId = await createNode(ctx.member, ctx.projectId, ctx.chapterId)
  await post(ctx.member, ctx, nodeId, 'hello')
  const [commenter, editor] = [await holder(ctx, 'comment'), await holder(ctx, 'edit')]
  const viewer = await createUser()
  await joinShare((await createLink(ctx.member, ctx.projectId, 'view', 'live')).token, viewer)

  for (const user of [ctx.member, ctx.owner, commenter.user, editor.user]) expect(await seen(user, ctx.projectId)).toBe(1)
  for (const user of [await createUser(), viewer, null]) expect(await seen(user, ctx.projectId)).toBe(0)
  await revokeLink(ctx.member, commenter.linkId)
  expect(await seen(commenter.user, ctx.projectId)).toBe(0)
})

// Protects D13 and security.md 5: only allowed people comment, as themselves, on a live node
// of the project; the name is the server's; text goes in as typed (including SQL-looking text).
test('only allowed people comment, as themselves, on a live node', async () => {
  const ctx = await memberProject()
  const nodeId = await createNode(ctx.member, ctx.projectId, ctx.chapterId)
  const other = await memberProject()
  const otherNode = await createNode(other.member, other.projectId, other.chapterId)
  const admin = await asAdmin()
  await admin.collection('users').update(ctx.member.id, { name: 'Mara' })
  const { user: commenter } = await holder(ctx, 'comment')
  const unverified = await unverifiedUser()
  await addMember((await admin.collection('projects').getOne(ctx.projectId)).team as string, unverified)

  const injection = "' OR 1=1 --"
  const made = await post(ctx.member, ctx, nodeId, injection)
  expect([made.author_name, made.body]).toEqual(['Mara', injection])
  expect((await post(commenter, ctx, nodeId, 'from a link')).author_name).toBe('Someone')
  const before = await countOf(ctx.projectId)

  const trashed = await createNode(ctx.member, ctx.projectId, ctx.chapterId)
  const version = Number((await readAsAdmin('nodes', trashed)).version)
  expect((await guardedUpdate(ctx.member, 'nodes', trashed, { deleted_at: '2026-11-20 10:00:00.000Z', version })).status).toBe(200)
  const refused: (() => Promise<unknown>)[] = [
    () => post(unverified, ctx, nodeId, 'x'),
    async () => post(await createUser(), ctx, nodeId, 'x'),
    () => post(null, ctx, nodeId, 'x'),
    () => post(ctx.member, ctx, nodeId, 'x', { author: ctx.owner.id }),
    () => post(ctx.member, ctx, nodeId, 'x', { author_name: 'Boss' }),
    () => post(ctx.member, ctx, otherNode, 'x'),
    () => post(ctx.member, ctx, trashed, 'x'),
    () => post(ctx.member, ctx, nodeId, 'x'.repeat(2001)),
    () => post(ctx.member, ctx, nodeId, ''),
  ]
  for (const attempt of refused) expect([400, 403, 404]).toContain(await failure(attempt()))
  expect(await countOf(ctx.projectId)).toBe(before)
  await setVerified(unverified, true)
})

// Protects design 5: the author deletes their own, the team owner deletes any, nobody else
// does (a link holder included), and a comment is never edited.
test('authors delete their own comments and the owner deletes any', async () => {
  const ctx = await memberProject()
  const nodeId = await createNode(ctx.member, ctx.projectId, ctx.chapterId)
  const mate = await createUser()
  await addMember(ctx.teamId, mate)
  const { user: commenter } = await holder(ctx, 'comment')

  const own = await post(ctx.member, ctx, nodeId, 'mine')
  expect(await failure((await asUser(mate)).collection('comments').delete(own.id))).toBe(404)
  expect(await failure((await asUser(commenter)).collection('comments').delete(own.id))).toBe(404)
  expect(await failure((await asUser(ctx.member)).collection('comments').update(own.id, { body: 'changed' }))).toBe(403)
  expect(await failure((await asUser(ctx.owner)).collection('comments').update(own.id, { body: 'changed' }))).toBe(403)
  await (await asUser(ctx.member)).collection('comments').delete(own.id)
  expect(await countOf(ctx.projectId)).toBe(0)

  const theirs = await post(ctx.member, ctx, nodeId, 'to be removed by the owner')
  await (await asUser(ctx.owner)).collection('comments').delete(theirs.id)
  const fromLink = await post(commenter, ctx, nodeId, 'link holder')
  await (await asUser(commenter)).collection('comments').delete(fromLink.id)
  expect(await countOf(ctx.projectId)).toBe(0)
})

// Protects D11 and D13: a teammate's comment reaches an open subscription, and the
// purge of a node takes its comments with it.
test('comments arrive live and leave with their node', async () => {
  const ctx = await memberProject()
  const nodeId = await createNode(ctx.member, ctx.projectId, ctx.chapterId)
  const pb = await asUser(ctx.owner)
  const events: string[] = []
  await pb.collection('comments').subscribe('*', (e) => events.push(`${e.action}:${e.record.body}`), { filter: pb.filter('project = {:p}', { p: ctx.projectId }) })
  await post(ctx.member, ctx, nodeId, 'live one')
  await expect.poll(() => events, { timeout: 4000 }).toContain('create:live one')
  await pb.collection('comments').unsubscribe('*')

  await post(ctx.member, ctx, nodeId, 'second')
  const admin = await asAdmin()
  const behavior = await admin.collection('system_behavior').getFirstListItem('')
  const days = behavior.trash_retention_days as number
  try {
    await admin.collection('system_behavior').update(behavior.id, { trash_retention_days: 0 })
    const version = Number((await readAsAdmin('nodes', nodeId)).version)
    expect((await guardedUpdate(ctx.member, 'nodes', nodeId, { deleted_at: '2026-11-20 10:00:00.000Z', version })).status).toBe(200)
    await admin.crons.run('purge_trash')
    await expect.poll(() => countOf(ctx.projectId), { timeout: 6000 }).toBe(0)
  } finally {
    await admin.collection('system_behavior').update(behavior.id, { trash_retention_days: days })
  }
})
