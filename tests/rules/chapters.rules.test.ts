import { expect, test } from 'vitest'
import { expectNoRows, expectRefused } from './helpers/admin-only.ts'
import { createProject, guardedUpdate, readAsAdmin } from './helpers/content.ts'
import { asAnonymous, asUser, createTeam, createUser, type TestUser } from './helpers/pb.ts'
import { addMember, expectCreateRefused } from './helpers/teams.ts'

// The server stamps its own trash time, so a wrong browser clock cannot expire work early; the sent value is ignored.
const nearNow = (t: unknown) => Math.abs(Date.parse(String(t).replace(' ', 'T')) - Date.now()) < 10_000

// Protects design section 5 (teams own projects and everything in them; any member edits
// chapters; only the owner deletes a project) and docs/security.md section 2 (deny by
// default). Chapters are the first collection checked against the version guard
// (decision 0002): the guarded update replaces PocketBase's own save, so these
// tests prove it is not a back door and that `version` is only ever set by the server.

const CONFLICT = 'This record was changed by someone else. Reload it and try again.'

async function memberProject(): Promise<{
  owner: TestUser
  member: TestUser
  teamId: string
  chapterId: string
  projectId: string
}> {
  const [owner, member] = [await createUser(), await createUser()]
  const team = await createTeam(owner)
  await addMember(team.id, member)
  const project = await createProject(owner, team.id)
  return { owner, member, teamId: team.id, chapterId: project.chapterId, projectId: project.id }
}

// Protects access: the hook that replaces the save must not let a non-member write.
test('the guarded update still refuses outsiders', async () => {
  const { chapterId } = await memberProject()
  const outsider = await createUser()

  for (const caller of [outsider, null]) {
    const reply = await guardedUpdate(caller, 'chapters', chapterId, { version: 0, title: 'Hijacked' })
    expect([403, 404]).toContain(reply.status)
  }
  for (const pb of [await asUser(outsider), asAnonymous()]) {
    await expectNoRows(pb, 'chapters')
    await expectRefused(pb.collection('chapters').getOne(chapterId))
  }
  expect(await readAsAdmin('chapters', chapterId)).toMatchObject({ title: 'Chapter 1', version: 0 })
})

// A write must carry the version it was based on; a stale or invented one is a 409;
// a create cannot choose its starting version.
test('an update needs the current version and create cannot set one', async () => {
  const { member, chapterId, projectId } = await memberProject()

  const missing = await guardedUpdate(member, 'chapters', chapterId, { title: 'No version' })
  expect([403, 404]).toContain(missing.status)
  expect(await readAsAdmin('chapters', chapterId)).toMatchObject({ title: 'Chapter 1', version: 0 })

  expect((await guardedUpdate(member, 'chapters', chapterId, { version: 0, title: 'First' })).status).toBe(200)
  for (const version of [0, 6]) {
    const stale = await guardedUpdate(member, 'chapters', chapterId, { version, title: 'Lost' })
    expect(stale.status).toBe(409)
    expect(stale.body).toMatchObject({ message: CONFLICT })
  }
  expect(await readAsAdmin('chapters', chapterId)).toMatchObject({ title: 'First', version: 1 })

  const pb = await asUser(member)
  await expectCreateRefused(
    pb.collection('chapters').create({ project: projectId, title: 'Forged', position: 2, version: 9 }),
  )
})

// A moved chapter would carry its content into another project, so a record's
// `project` is set on create and never changed.
test('a chapter cannot be moved to another project', async () => {
  const { member, teamId, chapterId, projectId } = await memberProject()
  const other = await createProject(member, teamId, 'Other')

  const reply = await guardedUpdate(member, 'chapters', chapterId, { version: 0, project: other.id })
  expect([403, 404]).toContain(reply.status)
  expect(await readAsAdmin('chapters', chapterId)).toMatchObject({ project: projectId, version: 0 })
})

// Design 5 and 6.8: any member manages chapters; deleting one is a move to the trash.
test('members create, rename and trash chapters', async () => {
  const { member, projectId } = await memberProject()
  const pb = await asUser(member)

  const created = await pb.collection('chapters').create({ project: projectId, title: 'Act two', position: 2 })
  expect(created).toMatchObject({ title: 'Act two', position: 2, version: 0, deleted_at: '' })
  await expectCreateRefused(
    pb.collection('chapters').create({ project: projectId, title: 'Gone', deleted_at: '2026-11-14 10:00:00.000Z' }),
  )

  const renamed = await guardedUpdate(member, 'chapters', created.id, { version: 0, title: 'Act II' })
  expect(renamed.status).toBe(200)
  expect(renamed.body).toMatchObject({ title: 'Act II', version: 1 })

  const trashed = await guardedUpdate(member, 'chapters', created.id, {
    version: 1,
    deleted_at: '2026-11-14 10:00:00.000Z',
  })
  expect(trashed.status).toBe(200)
  const stored = await readAsAdmin('chapters', created.id)
  expect(stored).toMatchObject({ title: 'Act II', version: 2 })
  expect(nearNow(stored.deleted_at)).toBe(true)

  await expectRefused(pb.collection('chapters').delete(created.id))
  expect(await readAsAdmin('chapters', created.id)).toMatchObject({ version: 2 })
})
