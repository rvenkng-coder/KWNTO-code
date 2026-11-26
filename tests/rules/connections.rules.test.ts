import { expect, test } from 'vitest'
import { expectNoRows, expectRefused } from './helpers/admin-only.ts'
import { createNode, createProject, guardedUpdate, memberProject, readAsAdmin } from './helpers/content.ts'
import { asAdmin, asAnonymous, asUser, createUser } from './helpers/pb.ts'
import { expectCreateRefused } from './helpers/teams.ts'

// Protects design section 5 (any member links nodes, saved per attribute through the
// version guard, decision 0002) and 6.1 (a choice leads from one node to another, at most
// once per pair; a node may loop back to itself), and docs/security.md section 2 (deny by
// default; a connection never reaches into another project).

// Protects project isolation: both ends belong to the connection's project, on create and after.
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
  expect(await readAsAdmin('connections', link.id)).toMatchObject({
    project: projectId,
    from_node: a,
    to_node: b,
    version: 0,
  })
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
  await expectCreateRefused(
    pb.collection('connections').create({ project: projectId, from_node: a, to_node: b, label: 'Again' }),
  )
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
  const link = await (
    await asUser(owner)
  )
    .collection('connections')
    .create({ project: projectId, from_node: a, to_node: b })
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

// Protects empty choices (a choice may be empty, then linked, re-linked and
// unlinked, keeping its id and text) and security.md section 2 (every change goes through
// the version guard).
test('a choice may be empty and be linked, re-linked and unlinked later', async () => {
  const { member, projectId, chapterId } = await memberProject()
  const [a, b, c] = [
    await createNode(member, projectId, chapterId),
    await createNode(member, projectId, chapterId),
    await createNode(member, projectId, chapterId),
  ]
  const pb = await asUser(member)

  const choice = await pb
    .collection('connections')
    .create({ project: projectId, from_node: a, to_node: '', label: 'Wait' })
  expect(choice.to_node).toBe('')

  for (const [version, to] of [
    [0, b],
    [1, c],
    [2, ''],
  ] as const) {
    const reply = await guardedUpdate(member, 'connections', choice.id, { version, to_node: to })
    expect(reply.status).toBe(200)
  }
  expect(await readAsAdmin('connections', choice.id)).toMatchObject({ to_node: '', label: 'Wait', version: 3 })
})

// Protects security.md section 2: allowing to_node to be updated must not let a choice reach into
// another project or change its from_node or project.
test('a choice cannot be linked into another project', async () => {
  const { owner, member, teamId, projectId, chapterId } = await memberProject()
  const [a, b] = [await createNode(member, projectId, chapterId), await createNode(member, projectId, chapterId)]
  const other = await createProject(owner, teamId, 'Other')
  const foreign = await createNode(owner, other.id, other.chapterId)
  const pb = await asUser(member)

  await expectCreateRefused(pb.collection('connections').create({ project: projectId, from_node: a, to_node: foreign }))

  const choice = await pb.collection('connections').create({ project: projectId, from_node: a, to_node: '' })
  for (const body of [{ to_node: foreign }, { from_node: b }, { project: other.id }]) {
    const reply = await guardedUpdate(member, 'connections', choice.id, { version: 0, ...body })
    expect([403, 404]).toContain(reply.status)
  }
  const outsider = await createUser()
  expect([403, 404]).toContain(
    (await guardedUpdate(outsider, 'connections', choice.id, { version: 0, to_node: b })).status,
  )
  await expectRefused(asAnonymous().collection('connections').update(choice.id, { version: 0, to_node: b }))
  expect(await readAsAdmin('connections', choice.id)).toMatchObject({
    project: projectId,
    from_node: a,
    to_node: '',
    version: 0,
  })
})

// Protects the pair rule: one choice per target, and any number of empty choices.
test('a node may have many empty choices but one choice per target', async () => {
  const { member, projectId, chapterId } = await memberProject()
  const [a, b] = [await createNode(member, projectId, chapterId), await createNode(member, projectId, chapterId)]
  const pb = await asUser(member)

  await pb.collection('connections').create({ project: projectId, from_node: a, to_node: '' })
  const second = await pb.collection('connections').create({ project: projectId, from_node: a, to_node: '' })
  await pb.collection('connections').create({ project: projectId, from_node: a, to_node: b })
  await expectCreateRefused(pb.collection('connections').create({ project: projectId, from_node: a, to_node: b }))

  const relink = await guardedUpdate(member, 'connections', second.id, { version: 0, to_node: b })
  expect(relink.status).not.toBe(200)
})

// Protects the choice order: choices are listed by `created`, which is the server's own time, so a client cannot
// backdate a choice to take another's place. (A choice that undo makes again therefore joins the end of the list
// after a reload.)
test('a client cannot set the created time of a choice', async () => {
  const { member, projectId, chapterId } = await memberProject()
  const a = await createNode(member, projectId, chapterId)
  const choice = await (
    await asUser(member)
  )
    .collection('connections')
    .create({ project: projectId, from_node: a, to_node: '', created: '2020-01-01 00:00:00.000Z' })
  expect(choice.created).not.toBe('2020-01-01 00:00:00.000Z')
})
