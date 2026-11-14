import { expect, test } from 'vitest'
import { expectNoRows, expectRefused } from './helpers/admin-only.ts'
import { createNode, createProject, guardedUpdate, memberProject, readAsAdmin } from './helpers/content.ts'
import { asAdmin, asAnonymous, asUser, createUser } from './helpers/pb.ts'
import { expectCreateRefused } from './helpers/teams.ts'

// Protects design section 5 (any member links nodes, saved per attribute through the
// version guard, decision 0002) and 6.1 (a choice leads from one node to another, at most
// once per pair; a node may loop back to itself), and docs/security.md section 2 (deny by
// default; a connection never reaches into another project, plan Review Focus 2).

// Review Focus 2: both ends belong to the connection's project, on create and after.
test('a connection cannot reach into another project', async () => {
  const { owner, member, teamId, projectId, chapterId } = await memberProject()
  const [a, b] = [await createNode(member, projectId, chapterId), await createNode(member, projectId, chapterId)]
  const other = await createProject(owner, teamId, 'Other')
  const foreign = await createNode(owner, other.id, other.chapterId)
  const pb = await asUser(member)

  await expectCreateRefused(pb.collection('connections').create({ project: projectId, from_node: a, to_node: foreign }))
  await expectCreateRefused(pb.collection('connections').create({ project: projectId, from_node: foreign, to_node: a }))

  const link = await pb.collection('connections').create({ project: projectId, from_node: a, to_node: b })
  for (const body of [{ from_node: foreign }, { to_node: foreign }, { from_node: b }, { project: other.id }]) {
    const reply = await guardedUpdate(member, 'connections', link.id, { version: 0, ...body })
    expect([403, 404]).toContain(reply.status)
  }
  expect(await readAsAdmin('connections', link.id)).toMatchObject({ project: projectId, from_node: a, to_node: b, version: 0 })
  const admin = await asAdmin()
  const stray = admin.filter('from_node = {:n} || to_node = {:n}', { n: foreign })
  expect(await admin.collection('connections').getFullList({ filter: stray })).toEqual([])
})

// Design 6.1: one connection per ordered pair; a self-link is allowed; labels are edited
// through the guard.
test('two nodes have at most one connection and a node may link to itself', async () => {
  const { member, projectId, chapterId } = await memberProject()
  const [a, b] = [await createNode(member, projectId, chapterId), await createNode(member, projectId, chapterId)]
  const pb = await asUser(member)

  const link = await pb.collection('connections').create({ project: projectId, from_node: a, to_node: b, label: 'Go' })
  await expectCreateRefused(pb.collection('connections').create({ project: projectId, from_node: a, to_node: b, label: 'Again' }))
  const back = await pb.collection('connections').create({ project: projectId, from_node: b, to_node: a })
  expect(back).toMatchObject({ from_node: b, to_node: a })

  const loop = await pb.collection('connections').create({ project: projectId, from_node: a, to_node: a })
  expect(loop).toMatchObject({ from_node: a, to_node: a, version: 0 })

  const relabelled = await guardedUpdate(member, 'connections', link.id, { version: 0, label: 'Leave' })
  expect(relabelled.status).toBe(200)
  expect(await readAsAdmin('connections', link.id)).toMatchObject({ label: 'Leave', version: 1 })
})

// Security 2: connections are hidden from outsiders and signed-out callers.
test('outsiders and signed-out callers cannot reach connections', async () => {
  const { owner, projectId, chapterId } = await memberProject()
  const [a, b] = [await createNode(owner, projectId, chapterId), await createNode(owner, projectId, chapterId)]
  const link = await (await asUser(owner)).collection('connections').create({ project: projectId, from_node: a, to_node: b })
  const outsider = await createUser()

  for (const pb of [await asUser(outsider), asAnonymous()]) {
    await expectNoRows(pb, 'connections')
    await expectNoRows(pb, 'connections', pb.filter('label = {:t}', { t: `' OR 1=1 --` }))
    await expectRefused(pb.collection('connections').getOne(link.id))
    await expectRefused(pb.collection('connections').delete(link.id))
    await expectCreateRefused(pb.collection('connections').create({ project: projectId, from_node: b, to_node: a }))
  }
  expect(await readAsAdmin('connections', link.id)).toMatchObject({ from_node: a, to_node: b })
})
