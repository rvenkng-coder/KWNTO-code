import { expect, test } from 'vitest'
import { expectNoRows, expectRefused } from './helpers/admin-only.ts'
import { createNode, createProject, guardedUpdate, memberProject, readAsAdmin } from './helpers/content.ts'
import { asAdmin, asAnonymous, asUser, createTeam, createUser } from './helpers/pb.ts'
import { addMember, expectCreateRefused } from './helpers/teams.ts'

// Protects design section 5 (teams own projects; any member creates and edits a project;
// only the team owner deletes one, which is a move to the trash, design 6.8) and
// docs/security.md section 2 (deny by default: outsiders and signed-out callers get
// nothing). Also plan decisions D6 (settings and Chapter 1 come with every project) and
// D13 (deleting a team removes its projects).

const TRASHED_AT = '2026-11-14 10:00:00.000Z'
// The server stamps its own trash time (Plan 7 D11); the browser's value is ignored.
const nearNow = (t: unknown) => Math.abs(Date.parse(String(t).replace(' ', 'T')) - Date.now()) < 10_000

async function rowsOf(collection: string, projectId: string): Promise<Record<string, unknown>[]> {
  const admin = await asAdmin()
  return admin.collection(collection).getFullList({ filter: admin.filter('project = {:p}', { p: projectId }) })
}

// D6: a project never exists without its settings row and a first chapter.
test('a member creates a project with its settings and first chapter', async () => {
  const [owner, member] = [await createUser(), await createUser()]
  const team = await createTeam(owner)
  await addMember(team.id, member)

  const created = await (await asUser(member)).collection('projects').create({ team: team.id, name: 'Story' })
  expect(created).toMatchObject({ name: 'Story', team: team.id, version: 0 })

  const settings = await rowsOf('project_settings', created.id)
  expect(settings).toHaveLength(1)
  expect(settings[0]).toMatchObject({ analytics_enabled: false, version: 0 })
  const chapters = await rowsOf('chapters', created.id)
  expect(chapters).toHaveLength(1)
  expect(chapters[0]).toMatchObject({ title: 'Chapter 1', position: 1, version: 0 })
})

// Security 2: someone outside the team, or signed out, cannot see or add projects.
test('outsiders and signed-out callers cannot reach a project', async () => {
  const [owner, outsider] = [await createUser(), await createUser()]
  const team = await createTeam(owner)
  const project = await createProject(owner, team.id)

  for (const pb of [await asUser(outsider), asAnonymous()]) {
    await expectNoRows(pb, 'projects')
    await expectNoRows(pb, 'projects', pb.filter('name = {:n}', { n: `' OR 1=1 --` }))
    await expect(pb.collection('projects').getOne(project.id)).rejects.toMatchObject({ status: 404 })
    await expectCreateRefused(pb.collection('projects').create({ team: team.id, name: 'Intruder' }))
  }
  expect(await rowsOf('chapters', project.id)).toHaveLength(1)
  const admin = await asAdmin()
  const all = await admin.collection('projects').getFullList({ filter: admin.filter('team = {:t}', { t: team.id }) })
  expect(all.map((p) => p.id)).toEqual([project.id])
})

// Design 5: only the owner deletes a project; trashing is that delete (design 6.8).
test('only the team owner moves a project to the trash', async () => {
  const [owner, member] = [await createUser(), await createUser()]
  const team = await createTeam(owner)
  await addMember(team.id, member)
  const project = await createProject(member, team.id)

  const refused = await guardedUpdate(member, 'projects', project.id, { version: 0, deleted_at: TRASHED_AT })
  expect([403, 404]).toContain(refused.status)
  expect(await readAsAdmin('projects', project.id)).toMatchObject({ deleted_at: '', version: 0 })

  const allowed = await guardedUpdate(owner, 'projects', project.id, { version: 0, deleted_at: TRASHED_AT })
  expect(allowed.status).toBe(200)
  const stored = await readAsAdmin('projects', project.id)
  expect(stored).toMatchObject({ version: 1 })
  expect(nearNow(stored.deleted_at)).toBe(true)
})

// A moved project would hand one team's work to another (design 5: teams own projects).
test('a project cannot be moved to another team', async () => {
  const owner = await createUser()
  const team = await createTeam(owner)
  const otherTeam = await createTeam(owner, 'Other team')
  const project = await createProject(owner, team.id)

  const reply = await guardedUpdate(owner, 'projects', project.id, { version: 0, team: otherTeam.id })
  expect([403, 404]).toContain(reply.status)
  expect(await readAsAdmin('projects', project.id)).toMatchObject({ team: team.id, version: 0 })
})

// D13: a team's projects, their settings and chapters go with the team.
test('deleting a team removes its projects', async () => {
  const owner = await createUser()
  const team = await createTeam(owner)
  const project = await createProject(owner, team.id)

  await (await asUser(owner)).collection('teams').delete(team.id)

  const admin = await asAdmin()
  await expectRefused(admin.collection('projects').getOne(project.id))
  await expectRefused(admin.collection('project_settings').getOne(project.settingsId))
  await expectRefused(admin.collection('chapters').getOne(project.chapterId))
})

// Plan D7: the first node made in a project becomes its start node when it is saved, and
// the project's version rises once so a stale edit of the project is refused.
test('the first node becomes the start node', async () => {
  const { member, projectId, chapterId } = await memberProject()
  expect(await readAsAdmin('projects', projectId)).toMatchObject({ start_node: '', version: 0 })

  const first = await createNode(member, projectId, chapterId)
  expect(await readAsAdmin('projects', projectId)).toMatchObject({ start_node: first, version: 1 })

  await createNode(member, projectId, chapterId)
  expect(await readAsAdmin('projects', projectId)).toMatchObject({ start_node: first, version: 1 })
})

// Review Focus 2: a project cannot start at a node of another project.
test('the start node must belong to the project', async () => {
  const { owner, member, teamId, projectId, chapterId } = await memberProject()
  const first = await createNode(member, projectId, chapterId)
  const second = await createNode(member, projectId, chapterId)
  const other = await createProject(owner, teamId, 'Other')
  const foreign = await createNode(owner, other.id, other.chapterId)
  const version = Number((await readAsAdmin('projects', projectId)).version)

  const refused = await guardedUpdate(member, 'projects', projectId, { version, start_node: foreign })
  expect([403, 404]).toContain(refused.status)
  expect(await readAsAdmin('projects', projectId)).toMatchObject({ start_node: first, version })

  const moved = await guardedUpdate(member, 'projects', projectId, { version, start_node: second })
  expect(moved.status).toBe(200)
  expect(await readAsAdmin('projects', projectId)).toMatchObject({ start_node: second, version: version + 1 })
})

// Protects the offline-sync carry-over of plan 3 (plan 7 Task 7, D15): a project a member
// makes reaches a teammate's open list as a live `create` event, and its settings row and
// `Chapter 1` still exist.
test('a new project arrives as a live create event with its settings and first chapter', async () => {
  const { owner, member, teamId } = await memberProject()
  const watcher = await asUser(owner)
  const events: string[] = []
  await watcher.collection('projects').subscribe('*', (e) => events.push(`${e.action}:${String(e.record.name)}`))

  const made = await (await asUser(member)).collection('projects').create({ team: teamId, name: 'Live project' })
  await expect.poll(() => events, { timeout: 4000 }).toContain('create:Live project')
  await watcher.collection('projects').unsubscribe('*')

  const admin = await asAdmin()
  const filter = admin.filter('project = {:p}', { p: made.id })
  expect(await admin.collection('project_settings').getFullList({ filter })).toHaveLength(1)
  const chapters = await admin.collection('chapters').getFullList({ filter })
  expect(chapters.map((c) => [c.title, c.position])).toEqual([['Chapter 1', 1]])
})
