import { expect, test } from 'vitest'
import { expectNoRows, expectRefused } from './helpers/admin-only.ts'
import { createNode, createProject, guardedUpdate, memberProject, readAsAdmin } from './helpers/content.ts'
import { asAdmin, asAnonymous, asUser, createUser } from './helpers/pb.ts'
import { expectCreateRefused } from './helpers/teams.ts'

// Protects design section 5 (any member writes a node's cues, saved per attribute through
// the version guard, decision 0002), the ERD (a cue is audio, lighting or other) and
// docs/security.md section 2 (deny by default; no cue may point into another project).

// ERD: three cue types; a cue stays on a node of its own project.
test('cues take only the three types and stay in their project', async () => {
  const { owner, member, teamId, projectId, chapterId } = await memberProject()
  const nodeId = await createNode(member, projectId, chapterId)
  const other = await createProject(owner, teamId, 'Other')
  const foreignNode = await createNode(owner, other.id, other.chapterId)
  const pb = await asUser(member)

  await expectCreateRefused(
    pb.collection('cues').create({ project: projectId, node: nodeId, type: 'video', sort_order: 1 }),
  )
  await expectCreateRefused(
    pb.collection('cues').create({ project: projectId, node: foreignNode, type: 'audio', sort_order: 1 }),
  )

  const cue = await pb
    .collection('cues')
    .create({ project: projectId, node: nodeId, type: 'lighting', text: 'Dim', sort_order: 1 })
  expect(cue).toMatchObject({ type: 'lighting', text: 'Dim', version: 0 })

  const moved = await guardedUpdate(member, 'cues', cue.id, { version: 0, node: foreignNode })
  expect([403, 404]).toContain(moved.status)
  const edited = await guardedUpdate(member, 'cues', cue.id, { version: 0, text: 'Blackout' })
  expect(edited.status).toBe(200)
  expect(await readAsAdmin('cues', cue.id)).toMatchObject({ node: nodeId, text: 'Blackout', version: 1 })
  const admin = await asAdmin()
  expect(
    await admin.collection('cues').getFullList({ filter: admin.filter('node = {:n}', { n: foreignNode }) }),
  ).toEqual([])
})

// Security 2: cues are hidden from outsiders and signed-out callers; injection is data.
test('outsiders and signed-out callers cannot reach cues', async () => {
  const { owner, projectId, chapterId } = await memberProject()
  const nodeId = await createNode(owner, projectId, chapterId)
  const cue = await (
    await asUser(owner)
  )
    .collection('cues')
    .create({ project: projectId, node: nodeId, type: 'audio', sort_order: 1 })
  const outsider = await createUser()

  for (const pb of [await asUser(outsider), asAnonymous()]) {
    await expectNoRows(pb, 'cues')
    await expectNoRows(pb, 'cues', pb.filter('text = {:t}', { t: `' OR 1=1 --` }))
    await expectRefused(pb.collection('cues').getOne(cue.id))
    await expectRefused(pb.collection('cues').delete(cue.id))
    await expectCreateRefused(
      pb.collection('cues').create({ project: projectId, node: nodeId, type: 'other', sort_order: 2 }),
    )
  }
  expect(await readAsAdmin('cues', cue.id)).toMatchObject({ type: 'audio', version: 0 })
})
