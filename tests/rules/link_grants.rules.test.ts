import { expect, test } from 'vitest'
import { asAdmin, asAnonymous, asUser, createUser } from './helpers/pb.ts'
import { createLink, revokeLink } from './helpers/share.ts'
import { memberProject } from './helpers/content.ts'

// Rules of `link_grants` (design 5): the join route makes a grant for a signed-in person; the
// holder reads only their own, and only while the link stands.

type Failure = { status?: number }

async function statusOf(promise: Promise<unknown>): Promise<number> {
  try {
    await promise
    return 200
  } catch (error) {
    return (error as Failure).status ?? 0
  }
}

// Protects the edit grants: grants are private to their holder, written only by the server, and stop
// being visible once the link is revoked.
test('grants are made only by the server and seen only by their holder', async () => {
  const { owner, member, projectId } = await memberProject()
  const holder = await createUser()
  const other = await createUser()
  const link = await createLink(member, projectId, 'edit', 'live')
  const admin = await asAdmin()
  const grant = await admin.collection('link_grants').create({
    link: link.id,
    user: holder.id,
    project: projectId,
    permission: 'edit',
    project_name: 'Test project',
  })

  const own = await (await asUser(holder)).collection('link_grants').getFullList()
  expect(own.map((row) => row.id)).toEqual([grant.id])
  expect(own[0].project_name).toBe('Test project')
  expect(await (await asUser(other)).collection('link_grants').getFullList()).toEqual([])
  expect(await (await asUser(owner)).collection('link_grants').getFullList()).toEqual([])
  expect(await statusOf((await asUser(other)).collection('link_grants').getOne(grant.id))).toBe(404)
  expect(await statusOf(asAnonymous().collection('link_grants').getOne(grant.id))).toBe(404)
  expect(await statusOf((await asUser(holder)).collection('link_grants').getOne("' OR 1=1 --"))).toBe(404)

  const row = { link: link.id, user: other.id, project: projectId, permission: 'edit', project_name: 'x' }
  for (const who of [holder, other, owner]) {
    const pb = await asUser(who)
    expect(await statusOf(pb.collection('link_grants').create(row))).toBe(403)
    expect(await statusOf(pb.collection('link_grants').update(grant.id, { permission: 'comment' }))).toBe(403)
    expect(await statusOf(pb.collection('link_grants').delete(grant.id))).toBe(403)
  }
  expect(await statusOf(asAnonymous().collection('link_grants').create(row))).toBe(403)

  await revokeLink(owner, link.id)
  expect(await (await asUser(holder)).collection('link_grants').getFullList()).toEqual([])
})
