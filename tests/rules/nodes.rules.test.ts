import { expect, test } from 'vitest'
import { expectNoRows, expectRefused } from './helpers/admin-only.ts'
import { createLine, createNode, createProject, guardedUpdate, memberProject, readAsAdmin, saveOwnFields } from './helpers/content.ts'
import { asAdmin, asAnonymous, asUser, createTeam, createUser } from './helpers/pb.ts'
import { addMember, expectCreateRefused } from './helpers/teams.ts'

// Protects design section 5 (teams own projects and everything in them; any member edits
// nodes; saving per attribute, so two people's edits of one node both land) and
// docs/security.md section 2 (deny by default: outsiders and signed-out callers get
// nothing, and no record may point into a project the caller does not own a part of).
// Also plan Review Focus 1 and 2, and design 6.8 (a node is trashed, never deleted by a
// member; the server's purge removes it with everything that hangs off it).

const TRASHED_AT = '2026-11-14 10:00:00.000Z'

// Task 12 (undo) and Plan 4 (offline queue) need the browser to choose the id.
test('a member creates a node with the id the client chose', async () => {
  const { member, projectId, chapterId } = await memberProject()

  const id = await createNode(member, projectId, chapterId, { id: 'abcdefghijk0123', color: 'blue' })

  expect(id).toBe('abcdefghijk0123')
  expect(await readAsAdmin('nodes', id)).toMatchObject({ project: projectId, chapter: chapterId, color: 'blue', version: 0 })
})

// Review Focus 2: a node in project A must not sit in a chapter of project B, whether or
// not the caller can see B.
test('a node cannot be placed in another project\'s chapter', async () => {
  const { owner, member, teamId, projectId } = await memberProject()
  const otherTeam = await createTeam(owner, 'Other team')
  const both = await createUser()
  await addMember(teamId, both)
  await addMember(otherTeam.id, both)
  const foreign = await createProject(owner, otherTeam.id)

  for (const user of [both, member]) {
    await expectCreateRefused(
      (await asUser(user)).collection('nodes').create({ project: projectId, chapter: foreign.chapterId, color: 'slate' }),
    )
  }
  const admin = await asAdmin()
  expect(await admin.collection('nodes').getFullList({ filter: admin.filter('chapter = {:c}', { c: foreign.chapterId }) })).toEqual([])
})

// Records carry `project`, set on create and never changed; nodes do not move between
// chapters (plan D9: cut and paste instead).
test('a node keeps its project and chapter', async () => {
  const { member, teamId, projectId, chapterId } = await memberProject()
  const nodeId = await createNode(member, projectId, chapterId)
  const other = await createProject(member, teamId, 'Other')
  const secondChapter = await (await asUser(member)).collection('chapters').create({ project: projectId, title: 'Two', position: 2 })

  for (const body of [{ project: other.id }, { chapter: secondChapter.id }]) {
    const reply = await guardedUpdate(member, 'nodes', nodeId, { version: 0, ...body })
    expect([403, 404]).toContain(reply.status)
  }
  expect(await readAsAdmin('nodes', nodeId)).toMatchObject({ project: projectId, chapter: chapterId, version: 0 })
})

// Review Focus 1: one person renames a node while another drags it; both edits land.
test('parallel edits of a node\'s title and position both survive', async () => {
  const { owner, member, projectId, chapterId } = await memberProject()
  const nodeId = await createNode(owner, projectId, chapterId)
  const [first, second] = [await asUser(owner), await asUser(member)]

  for (let round = 1; round <= 5; round++) {
    const before = Number((await readAsAdmin('nodes', nodeId)).version)
    const title = `Round ${round} ${crypto.randomUUID()}`
    const [x, y] = [round * 10.5, round * -3]

    await Promise.all([
      saveOwnFields(first, 'nodes', nodeId, before, { title }),
      saveOwnFields(second, 'nodes', nodeId, before, { x, y }),
    ])

    expect(await readAsAdmin('nodes', nodeId), `round ${round}`).toMatchObject({ title, x, y, version: before + 2 })
  }
}, 30_000)

// Security 2: no node is visible or writable from outside the team; injection is data.
test('outsiders and signed-out callers cannot reach nodes', async () => {
  const { owner, projectId, chapterId } = await memberProject()
  const nodeId = await createNode(owner, projectId, chapterId, { title: 'Secret' })
  const outsider = await createUser()

  for (const pb of [await asUser(outsider), asAnonymous()]) {
    await expectNoRows(pb, 'nodes')
    await expectNoRows(pb, 'nodes', pb.filter('title = {:t}', { t: `' OR 1=1 --` }))
    await expectRefused(pb.collection('nodes').getOne(nodeId))
    await expectCreateRefused(pb.collection('nodes').create({ project: projectId, chapter: chapterId, color: 'red' }))
  }
  for (const caller of [outsider, null]) {
    const reply = await guardedUpdate(caller, 'nodes', nodeId, { version: 0, title: 'Hijacked' })
    expect([403, 404]).toContain(reply.status)
  }
  expect(await readAsAdmin('nodes', nodeId)).toMatchObject({ title: 'Secret', version: 0 })
})

// Design 6.8: members trash a node (deleted_at); only the server purges it, and a purge
// takes its lines, cues and connections with it and clears the project's start node.
test('nodes are trashed by members and purged only by the server', async () => {
  const { member, projectId, chapterId } = await memberProject()
  const pb = await asUser(member)
  const nodeId = await createNode(member, projectId, chapterId)
  const otherId = await createNode(member, projectId, chapterId)
  const lineId = await createLine(member, projectId, nodeId, { text: 'Hello' })
  const cue = await pb.collection('cues').create({ project: projectId, node: nodeId, type: 'audio', sort_order: 1 })
  const out = await pb.collection('connections').create({ project: projectId, from_node: nodeId, to_node: otherId })
  const into = await pb.collection('connections').create({ project: projectId, from_node: otherId, to_node: nodeId })

  await expectRefused(pb.collection('nodes').delete(nodeId))
  const trashed = await guardedUpdate(member, 'nodes', nodeId, { version: 0, deleted_at: TRASHED_AT })
  expect(trashed.status).toBe(200)
  expect(await readAsAdmin('nodes', nodeId)).toMatchObject({ deleted_at: TRASHED_AT, version: 1 })
  expect(await readAsAdmin('script_lines', lineId)).toMatchObject({ text: 'Hello' })

  const admin = await asAdmin()
  const project = await readAsAdmin('projects', projectId)
  await admin.collection('projects').update(projectId, { start_node: nodeId, version: project.version })

  await admin.collection('nodes').delete(nodeId)

  await expectRefused(admin.collection('script_lines').getOne(lineId))
  await expectRefused(admin.collection('cues').getOne(cue.id))
  await expectRefused(admin.collection('connections').getOne(out.id))
  await expectRefused(admin.collection('connections').getOne(into.id))
  expect(await readAsAdmin('projects', projectId)).toMatchObject({ start_node: '' })
  expect(await readAsAdmin('nodes', otherId)).toMatchObject({ version: 0 })
})

// Plan D13: deleting a team still removes its projects once they hold nodes, including
// the start node (projects.start_node points back at nodes).
test('deleting a team removes its projects with their nodes', async () => {
  const { owner, teamId, projectId, chapterId } = await memberProject()
  const nodeId = await createNode(owner, projectId, chapterId)
  const lineId = await createLine(owner, projectId, nodeId)
  const admin = await asAdmin()
  const project = await readAsAdmin('projects', projectId)
  await admin.collection('projects').update(projectId, { start_node: nodeId, version: project.version })

  await (await asUser(owner)).collection('teams').delete(teamId)

  await expectRefused(admin.collection('projects').getOne(projectId))
  await expectRefused(admin.collection('nodes').getOne(nodeId))
  await expectRefused(admin.collection('script_lines').getOne(lineId))
})
