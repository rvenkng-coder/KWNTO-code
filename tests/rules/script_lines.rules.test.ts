import { expect, test } from 'vitest'
import { expectRefused } from './helpers/admin-only.ts'
import {
  clientId,
  createLine,
  createNode,
  createProject,
  guardedUpdate,
  memberProject,
  readAsAdmin,
} from './helpers/content.ts'
import { asAdmin, asUser, createTeam, createUser } from './helpers/pb.ts'
import { expectCreateRefused } from './helpers/teams.ts'

// Protects design section 5 (any member writes a node's script lines; saving per
// attribute through the version guard, decision 0002) and docs/security.md section 2
// (deny by default; no line may point into another project). Lines are deleted outright, so undo
// re-creates them with their old id; that must never let anyone take over an id that is still in
// use.

// Protects project isolation: a line belongs to a node of its own project, and stays there.
test('a script line cannot point into another project', async () => {
  const { owner, member, teamId, projectId, chapterId } = await memberProject()
  const other = await createProject(owner, teamId, 'Other')
  const foreignNode = await createNode(owner, other.id, other.chapterId)
  const nodeId = await createNode(member, projectId, chapterId)
  const secondNode = await createNode(member, projectId, chapterId)

  await expectCreateRefused(
    (await asUser(member))
      .collection('script_lines')
      .create({ project: projectId, node: foreignNode, text: 'Stray', sort_order: 1 }),
  )

  const lineId = await createLine(member, projectId, nodeId, { text: 'Mine' })
  for (const body of [{ node: secondNode }, { node: foreignNode }, { project: other.id }]) {
    const reply = await guardedUpdate(member, 'script_lines', lineId, { version: 0, ...body })
    expect([403, 404]).toContain(reply.status)
  }
  expect(await readAsAdmin('script_lines', lineId)).toMatchObject({ project: projectId, node: nodeId, version: 0 })
  const admin = await asAdmin()
  expect(
    await admin.collection('script_lines').getFullList({ filter: admin.filter('node = {:n}', { n: foreignNode }) }),
  ).toEqual([])
})

// Design 5: members write and remove lines; someone outside the team cannot.
test('members write and delete script lines', async () => {
  const { owner, member, projectId, chapterId } = await memberProject()
  const nodeId = await createNode(owner, projectId, chapterId)
  const pb = await asUser(member)

  const created = await pb
    .collection('script_lines')
    .create({ project: projectId, node: nodeId, character: 'ANNA', text: 'Hi', sort_order: 1.5 })
  expect(created).toMatchObject({ character: 'ANNA', text: 'Hi', sort_order: 1.5, version: 0 })

  const edited = await guardedUpdate(member, 'script_lines', created.id, { version: 0, text: 'Hello' })
  expect(edited.status).toBe(200)
  expect(edited.body).toMatchObject({ character: 'ANNA', text: 'Hello', version: 1 })

  const outsider = await asUser(await createUser())
  await expectRefused(outsider.collection('script_lines').delete(created.id))
  expect(await readAsAdmin('script_lines', created.id)).toMatchObject({ text: 'Hello' })

  await pb.collection('script_lines').delete(created.id)
  await expectRefused((await asAdmin()).collection('script_lines').getOne(created.id))
})

// Undoing a delete re-creates the line under the id it had.
test('a deleted line can be re-created with its id', async () => {
  const { member, projectId, chapterId } = await memberProject()
  const nodeId = await createNode(member, projectId, chapterId)
  const pb = await asUser(member)
  const fields = { project: projectId, node: nodeId, character: 'BEN', text: 'Back again', sort_order: 2 }
  const id = clientId()

  expect((await pb.collection('script_lines').create({ id, ...fields })).id).toBe(id)
  await pb.collection('script_lines').delete(id)
  const again = await pb.collection('script_lines').create({ id, ...fields })

  expect(again).toMatchObject({ id, ...fields, version: 0 })
})

// A client-chosen id must not overwrite or hijack a line that already has it, whether the
// caller is in the same team or not.
test('an existing id cannot be taken over', async () => {
  const { owner, member, projectId, chapterId } = await memberProject()
  const nodeId = await createNode(owner, projectId, chapterId)
  const lineId = await createLine(owner, projectId, nodeId, { text: 'Original' })

  const outsider = await createUser()
  const theirTeam = await createTeam(outsider, 'Theirs')
  const theirs = await createProject(outsider, theirTeam.id)
  const theirNode = await createNode(outsider, theirs.id, theirs.chapterId)

  await expectCreateRefused(
    (await asUser(member))
      .collection('script_lines')
      .create({ id: lineId, project: projectId, node: nodeId, text: 'Taken', sort_order: 1 }),
  )
  await expectCreateRefused(
    (await asUser(outsider))
      .collection('script_lines')
      .create({ id: lineId, project: theirs.id, node: theirNode, text: 'Taken', sort_order: 1 }),
  )
  expect(await readAsAdmin('script_lines', lineId)).toMatchObject({
    project: projectId,
    node: nodeId,
    text: 'Original',
    version: 0,
  })
})
