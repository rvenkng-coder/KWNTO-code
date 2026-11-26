import { afterEach, expect, test } from 'vitest'
import { createBackend } from '../../frontend/src/backend/client'
import type { RemoteEvent } from '../../frontend/src/backend/content-types'
import {
  createLine,
  createNode,
  createProject,
  guardedUpdate,
  memberProject,
  readAsAdmin,
  type MemberProject,
} from './helpers/content.ts'
import { deleteAllMedia, PNG_1PX, uploadMedia } from './helpers/media.ts'
import { asUser, createUser, PB_URL, type TestUser } from './helpers/pb.ts'
import { createLink, joinShare, revokeLink } from './helpers/share.ts'

// Media made here must not outlive the file: other rule files count the whole table.
afterEach(deleteAllMedia)

// What an edit link opens in the content rules (design 5; plan 2026-11-20-sharing Task 3,
// D2 and D8): one project, never the team, only through ONE live grant row of permission
// `edit`. Grants are made by the join route, as a visitor would.

async function holderOf(
  ctx: MemberProject,
  permission: 'comment' | 'edit',
): Promise<{ holder: TestUser; linkId: string }> {
  const holder = await createUser()
  const link = await createLink(ctx.member, ctx.projectId, permission, 'live')
  expect((await joinShare(link.token, holder)).status).toBe(200)
  return { holder, linkId: link.id }
}

async function rename(user: TestUser, nodeId: string, title: string): Promise<number> {
  const version = Number((await readAsAdmin('nodes', nodeId)).version)
  return (await guardedUpdate(user, 'nodes', nodeId, { title, version })).status
}

async function visible(user: TestUser, collection: string): Promise<number> {
  return (await (await asUser(user)).collection(collection).getFullList()).length
}

async function failure(promise: Promise<unknown>): Promise<number> {
  try {
    await promise
    return 200
  } catch (error) {
    return (error as { status?: number }).status ?? 0
  }
}

// Protects Review Focus 4 and 1: an edit-grant holder works in the one project (read, edit,
// add lines, upload) and sees nothing else of the team; the owner-only actions stay closed;
// a comment grant edits nothing; and once the link is revoked every write is refused and
// the open live subscription stops receiving events.
test('an edit link opens one project, never the team, until revoked', async () => {
  const ctx = await memberProject()
  const { owner, member, teamId, projectId, chapterId } = ctx
  const other = await createProject(owner, teamId, 'Other')
  const nodeId = await createNode(member, projectId, chapterId, { title: 'start' })
  const { holder, linkId } = await holderOf(ctx, 'edit')
  const asHolder = await asUser(holder)

  expect((await asHolder.collection('projects').getOne(projectId)).id).toBe(projectId)
  expect((await asHolder.collection('nodes').getOne(nodeId)).title).toBe('start')
  expect(await rename(holder, nodeId, 'edited')).toBe(200)
  await createLine(holder, projectId, nodeId)
  expect(
    (await uploadMedia(holder, { project: projectId, node: nodeId }, { name: 'pic.png', bytes: PNG_1PX })).status,
  ).toBe(200)

  expect(await failure(asHolder.collection('teams').getOne(teamId))).toBe(404)
  expect(await failure(asHolder.collection('projects').getOne(other.id))).toBe(404)
  expect((await asHolder.collection('projects').getFullList()).map((p) => p.id)).toEqual([projectId])
  for (const collection of ['teams', 'team_members', 'team_settings']) expect(await visible(holder, collection)).toBe(0)
  const version = Number((await readAsAdmin('projects', projectId)).version)
  expect(
    (await guardedUpdate(holder, 'projects', projectId, { deleted_at: '2026-11-20 10:00:00.000Z', version })).status,
  ).toBe(404)
  const media = (await asHolder.collection('media').getFullList())[0]
  expect(await failure(asHolder.collection('media').delete(media.id))).toBe(404)

  const comment = await holderOf(ctx, 'comment')
  expect(await rename(comment.holder, nodeId, 'by a commenter')).toBe(404)
  expect(await visible(comment.holder, 'nodes')).toBe(0)

  const live = createBackend(PB_URL)
  await live.auth.signIn(holder.email, holder.password)
  const seen: RemoteEvent[] = []
  const close = await live.content.subscribe(projectId, (event) => seen.push(event))
  expect(await rename(member, nodeId, 'while linked')).toBe(200)
  await expect.poll(() => seen.length, { timeout: 4000 }).toBeGreaterThan(0)

  // A member's own stream is the positive control: events do flow after the revoke, so the
  // holder's silence below is the revoke's doing and not slowness.
  const memberLive = createBackend(PB_URL)
  await memberLive.auth.signIn(member.email, member.password)
  const memberSeen: RemoteEvent[] = []
  const closeMember = await memberLive.content.subscribe(projectId, (event) => memberSeen.push(event))

  await revokeLink(member, linkId)
  const before = seen.length
  expect(await rename(holder, nodeId, 'after revoke')).toBe(404)
  expect(await rename(member, nodeId, 'after revoke by member')).toBe(200)
  expect(await rename(member, nodeId, 'once more')).toBe(200)
  await expect.poll(() => memberSeen.length, { timeout: 4000 }).toBeGreaterThanOrEqual(2)
  expect(seen.length).toBe(before)
  expect(await failure(asHolder.collection('nodes').getOne(nodeId))).toBe(404)
  await close()
  await closeMember()
})

// Protects D2: the grant is one row, so a comment grant on one project plus an edit grant on
// another does not open the first, and a revoked grant on one project does not stop a live
// one on another.
test('one grant row decides, never parts of two', async () => {
  const [a, b] = [await memberProject(), await memberProject()]
  const nodeA = await createNode(a.member, a.projectId, a.chapterId)
  const nodeB = await createNode(b.member, b.projectId, b.chapterId)

  const mixed = await createUser()
  const commentOnA = await createLink(a.member, a.projectId, 'comment', 'live')
  const editOnB = await createLink(b.member, b.projectId, 'edit', 'live')
  expect((await joinShare(commentOnA.token, mixed)).status).toBe(200)
  expect((await joinShare(editOnB.token, mixed)).status).toBe(200)
  expect(await rename(mixed, nodeA, 'mixed')).toBe(404)
  expect(await rename(mixed, nodeB, 'mixed')).toBe(200)

  const split = await createUser()
  const editOnA = await createLink(a.member, a.projectId, 'edit', 'live')
  const liveOnB = await createLink(b.member, b.projectId, 'edit', 'live')
  expect((await joinShare(editOnA.token, split)).status).toBe(200)
  expect((await joinShare(liveOnB.token, split)).status).toBe(200)
  expect(await rename(split, nodeA, 'before')).toBe(200)
  await revokeLink(a.member, editOnA.id)
  expect(await rename(split, nodeA, 'refused')).toBe(404)
  expect(await rename(split, nodeB, 'allowed')).toBe(200)
})
