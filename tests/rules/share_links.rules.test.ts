import { expect, test } from 'vitest'
import { asAdmin, asAnonymous, asUser, createUser, type TestUser } from './helpers/pb.ts'
import { createLink, revokeLink } from './helpers/share.ts'
import { memberProject } from './helpers/content.ts'
import { unverifiedUser } from './helpers/invites.ts'
import { addMember } from './helpers/teams.ts'

// Rules of `share_links` (design 5; plan 2026-11-20-sharing Task 3, decisions D7 and D10).
// A link is made by a verified team member; the server makes its token and snapshot; a
// member may only revoke a link, never un-revoke, change or delete it.

type Failure = { status?: number }

async function statusOf(promise: Promise<unknown>): Promise<number> {
  try {
    await promise
    return 200
  } catch (error) {
    return (error as Failure).status ?? 0
  }
}

async function countLinks(projectId: string): Promise<number> {
  const admin = await asAdmin()
  return (
    await admin.collection('share_links').getFullList({ filter: admin.filter('project = {:p}', { p: projectId }) })
  ).length
}

function body(user: TestUser, projectId: string, extra: Record<string, unknown> = {}): Record<string, unknown> {
  return { project: projectId, created_by: user.id, permission: 'view', kind: 'live', ...extra }
}

// Protects security.md 2: only a verified member makes a link, the server alone makes its
// token (a client cannot choose one it knows) and a snapshot is view-only (D7).
test('only a verified member makes a link and the server makes its token', async () => {
  const { owner, member, projectId } = await memberProject()
  const outsider = await createUser()
  const unverified = await unverifiedUser()
  await addMember((await (await asAdmin()).collection('projects').getOne(projectId)).team, unverified)

  const live = await createLink(member, projectId, 'edit', 'live')
  const snap = await createLink(owner, projectId, 'view', 'snapshot')
  expect(live.token).toMatch(/^[A-Za-z0-9]{40}$/)
  expect(snap.token).toMatch(/^[A-Za-z0-9]{40}$/)
  const stored = await (await asAdmin()).collection('share_links').getOne(snap.id)
  expect((stored.snapshot_data as { format: string }).format).toBe('kwnto-project')
  expect((await (await asAdmin()).collection('share_links').getOne(live.id)).snapshot_data).toBeFalsy()

  const before = await countLinks(projectId)
  const asUnverified = await asUser(unverified)
  const asOutsider = await asUser(outsider)
  const asMember = await asUser(member)
  const attempts: (() => Promise<unknown>)[] = [
    () => asUnverified.collection('share_links').create(body(unverified, projectId)),
    () => asOutsider.collection('share_links').create(body(outsider, projectId)),
    () => asAnonymous().collection('share_links').create(body(member, projectId)),
    () => asMember.collection('share_links').create(body(member, projectId, { token: 'A'.repeat(40) })),
    () => asMember.collection('share_links').create(body(member, projectId, { revoked: true })),
    () => asMember.collection('share_links').create(body(member, projectId, { snapshot_data: { x: 1 } })),
    () => asMember.collection('share_links').create(body(owner, projectId)),
    () => asMember.collection('share_links').create(body(member, projectId, { kind: 'snapshot', permission: 'edit' })),
    () =>
      asMember.collection('share_links').create(body(member, projectId, { kind: 'snapshot', permission: 'comment' })),
  ]
  for (const attempt of attempts) {
    expect([400, 403, 404]).toContain(await statusOf(attempt()))
  }
  expect(await countLinks(projectId)).toBe(before)
})

// Protects D10: members see and revoke links; a revoked link cannot come back, nothing
// else of a link can change, and nobody deletes one through the API.
test('members see and revoke links and nobody edits or deletes them', async () => {
  const { owner, member, projectId } = await memberProject()
  const outsider = await createUser()
  const holder = await createUser()
  const link = await createLink(member, projectId, 'view', 'live')

  const listed = await (await asUser(owner)).collection('share_links').getFullList()
  expect(listed.map((row) => row.id)).toContain(link.id)
  expect(await (await asUser(outsider)).collection('share_links').getFullList()).toEqual([])
  expect(await statusOf((await asUser(outsider)).collection('share_links').getOne(link.id))).toBe(404)

  const admin = await asAdmin()
  const edit = await createLink(owner, projectId, 'edit', 'live')
  await admin
    .collection('link_grants')
    .create({ link: edit.id, user: holder.id, project: projectId, permission: 'edit', project_name: 'x' })
  expect(await (await asUser(holder)).collection('share_links').getFullList()).toEqual([])

  const asMember = await asUser(member)
  await asMember.collection('share_links').update(link.id, { revoked: true })
  expect((await admin.collection('share_links').getOne(link.id)).revoked).toBe(true)
  expect(await statusOf(asMember.collection('share_links').update(link.id, { revoked: false }))).toBe(404)
  expect(await statusOf(asMember.collection('share_links').update(edit.id, { permission: 'view' }))).toBe(404)
  expect(
    await statusOf(asMember.collection('share_links').update(edit.id, { revoked: true, permission: 'view' })),
  ).toBe(404)
  expect(await statusOf(asMember.collection('share_links').delete(edit.id))).toBe(403)
  expect(await statusOf((await asUser(outsider)).collection('share_links').update(edit.id, { revoked: true }))).toBe(
    404,
  )
  expect(await statusOf(asAnonymous().collection('share_links').update(edit.id, { revoked: true }))).toBe(404)
  expect((await admin.collection('share_links').getOne(edit.id)).revoked).toBe(false)

  const injected = await asMember.collection('share_links').getList(1, 10, { filter: "token = '' || 1=1" })
  expect(injected.items.length).toBeGreaterThan(0)
  expect(await statusOf(asMember.collection('share_links').getOne("' OR 1=1 --"))).toBe(404)
  await revokeLink(owner, edit.id)
})
