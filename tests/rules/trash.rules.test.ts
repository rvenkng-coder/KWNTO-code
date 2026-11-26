import { afterEach, expect, test } from 'vitest'
import { createLine, createNode, createProject, guardedUpdate, memberProject, readAsAdmin } from './helpers/content.ts'
import { PNG_1PX, uploadMedia } from './helpers/media.ts'
import { asAdmin, asUser, createUser, PB_URL, rawSend } from './helpers/pb.ts'
import { send, tokenOf } from './helpers/invites.ts'
import type { TestUser } from './helpers/pb.ts'

// Protects design 6.8: the trash time is the server's, the nightly purge_trash job removes only
// expired trash together with what hangs on it, members restore chapters and nodes, and only the
// owner restores a project. The job is run through PocketBase's own "run cron job" call (as in
// security_events.purge.rules.test.ts); it answers at once and works in the background, so these
// tests wait for the effect. Rule files run one at a time (vitest.config.ts), so a changed
// retention setting cannot disturb another file; afterEach restores it.

const JOB = 'purge_trash'
const OLD = '1970-01-01 00:00:00.000Z'
let restoreDays: (() => Promise<void>) | undefined

async function setRetentionDays(days: number): Promise<void> {
  const admin = await asAdmin()
  const record = await admin.collection('system_behavior').getFirstListItem('')
  const previous = record.trash_retention_days as number
  restoreDays ??= async () => {
    await admin.collection('system_behavior').update(record.id, { trash_retention_days: previous })
  }
  await admin.collection('system_behavior').update(record.id, { trash_retention_days: days })
}

afterEach(async () => {
  await restoreDays?.()
  restoreDays = undefined
})

async function versionOf(collection: string, id: string): Promise<number> {
  return Number((await readAsAdmin(collection, id)).version)
}

// Trashes or restores a record as the user, sending the deleted_at the browser would
// send (or any value a hand-made request sends).
async function setDeletedAt(user: TestUser, collection: string, id: string, deletedAt: string): Promise<number> {
  const reply = await guardedUpdate(user, collection, id, {
    deleted_at: deletedAt,
    version: await versionOf(collection, id),
  })
  return reply.status
}

async function exists(collection: string, id: string): Promise<boolean> {
  const admin = await asAdmin()
  const found = await admin.collection(collection).getList(1, 1, { filter: admin.filter('id = {:id}', { id }) })
  return found.totalItems === 1
}

async function storedDeletedAt(collection: string, id: string): Promise<string> {
  return String((await readAsAdmin(collection, id)).deleted_at)
}

// A node trashed 31 days ago, made straight through the admin API (only the server's own
// stamp is trusted on a member's request, so a member cannot make one). With the default 30
// days the job must delete it. It goes in the last stage of the job (nodes), so once it is
// gone the whole job has run: a test that expects other trash to be KEPT waits for this
// first, and so cannot pass before the job ran.
async function expiredSentinel(projectId: string, chapterId: string): Promise<string> {
  const longAgo = new Date(Date.now() - 31 * 24 * 60 * 60 * 1000).toISOString().replace('T', ' ')
  const node = await (await asAdmin()).collection('nodes').create({
    project: projectId,
    chapter: chapterId,
    title: 'sentinel',
    color: 'slate',
    x: 0,
    y: 0,
    deleted_at: longAgo,
  })
  return node.id
}

async function jobHasRun(sentinelId: string): Promise<void> {
  await expect
    .poll(() => exists('nodes', sentinelId), { message: 'the purge did not finish', timeout: 4000 })
    .toBe(false)
}

// Starts the job. PocketBase answers at once, so the tests wait for the effect themselves.
async function runJob(): Promise<void> {
  await (await asAdmin()).crons.run(JOB)
}

// Protects the schedule: the purge runs every night at 03:30 UTC, after the security log purge at 03:00.
test('the purge_trash job is registered at 03:30 every day', async () => {
  const jobs = await (await asAdmin()).crons.getFullList()
  expect(jobs.find((job) => job.id === JOB)?.expression).toBe('30 3 * * *')
})

// Protects teammates' work: a browser with a wrong clock, or a hand-made request, must
// not be able to date a teammate's work 31 days back and lose it at tonight's purge.
test("a trash time sent by the browser is replaced by the server's", async () => {
  const { member, projectId, chapterId } = await memberProject()
  const nodeId = await createNode(member, projectId, chapterId)

  expect(await setDeletedAt(member, 'nodes', nodeId, OLD)).toBe(200)
  const stamped = new Date(String(await storedDeletedAt('nodes', nodeId)).replace(' ', 'T')).getTime()
  expect(Math.abs(Date.now() - stamped)).toBeLessThan(10_000)

  const sentinel = await expiredSentinel(projectId, chapterId)
  await setRetentionDays(30)
  await runJob()
  await jobHasRun(sentinel)
  expect(await exists('nodes', nodeId), 'a node trashed a moment ago was purged').toBe(true)
})

type Hanging = {
  owner: TestUser
  projectId: string
  chapterA: string
  nodeA: string
  lineA: string
  cueA: string
  mediaA: { id: string; file: string }
  nodeN: string
  chapterB: string
  nodeM: string
  connection: string
  project2: string
  chapter2: string
}

// A project with chapter A (trashed, holding a node with a line, a cue and an image),
// node N in chapter B (trashed, the start node and the target of a choice from M), and a
// second trashed project.
async function trashedSet(): Promise<Hanging> {
  const { owner, teamId, projectId, chapterId } = await memberProject()
  const pb = await asUser(owner)
  const chapterA = (await pb.collection('chapters').create({ project: projectId, title: 'A', position: 2 })).id
  const chapterB = (await pb.collection('chapters').create({ project: projectId, title: 'B', position: 3 })).id
  const nodeA = await createNode(owner, projectId, chapterA)
  const nodeN = await createNode(owner, projectId, chapterB)
  const nodeM = await createNode(owner, projectId, chapterId)
  const lineA = await createLine(owner, projectId, nodeA)
  const cueA = (await pb.collection('cues').create({ project: projectId, node: nodeA, type: 'audio', sort_order: 1 }))
    .id
  const upload = await uploadMedia(owner, { project: projectId, node: nodeA }, { name: 'pic.png', bytes: PNG_1PX })
  expect(upload.status).toBe(200)
  const mediaA = (await upload.json()) as { id: string; file: string }
  const connection = (
    await pb.collection('connections').create({ project: projectId, from_node: nodeM, to_node: nodeN })
  ).id
  expect(
    (
      await guardedUpdate(owner, 'projects', projectId, {
        start_node: nodeN,
        version: await versionOf('projects', projectId),
      })
    ).status,
  ).toBe(200)

  const project2 = await createProject(owner, teamId, 'Second')
  expect(await setDeletedAt(owner, 'chapters', chapterA, OLD)).toBe(200)
  expect(await setDeletedAt(owner, 'nodes', nodeN, OLD)).toBe(200)
  expect(await setDeletedAt(owner, 'projects', project2.id, OLD)).toBe(200)
  return {
    owner,
    projectId,
    chapterA,
    nodeA,
    lineA,
    cueA,
    mediaA,
    nodeN,
    chapterB,
    nodeM,
    connection,
    project2: project2.id,
    chapter2: project2.chapterId,
  }
}

async function mediaFileServes(media: { id: string; file: string }): Promise<boolean> {
  const token = await (await asAdmin()).files.getToken()
  return (await fetch(`${PB_URL}/api/files/media/${media.id}/${media.file}?token=${token}`)).status === 200
}

// Protects design 6.8: what is expired goes, with everything that hangs on it
// (lines, cues, media rows and their files); a choice to a purged node is kept but empty;
// a purged start node empties the project's start; nothing else is touched.
test('the purge deletes expired trash with its contents and files', async () => {
  const set = await trashedSet()
  expect(await mediaFileServes(set.mediaA), 'the file should serve before the purge').toBe(true)

  await setRetentionDays(0)
  await runJob()
  await expect
    .poll(() => exists('nodes', set.nodeN), { message: 'the purge did not finish', timeout: 4000 })
    .toBe(false)

  expect(await exists('chapters', set.chapterA)).toBe(false)
  expect(await exists('nodes', set.nodeA)).toBe(false)
  expect(await exists('script_lines', set.lineA)).toBe(false)
  expect(await exists('cues', set.cueA)).toBe(false)
  expect(await exists('media', set.mediaA.id)).toBe(false)
  expect(await mediaFileServes(set.mediaA), 'the media file still serves').toBe(false)
  expect(await exists('projects', set.project2)).toBe(false)
  expect(await exists('chapters', set.chapter2)).toBe(false)

  expect((await readAsAdmin('connections', set.connection)).to_node).toBe('')
  expect((await readAsAdmin('projects', set.projectId)).start_node).toBe('')
  expect(await exists('nodes', set.nodeM)).toBe(true)
  expect(await exists('chapters', set.chapterB)).toBe(true)
})

// Protects recoverable trash: nothing inside the retention window is purged, so a job that runs too early or
// reads the setting wrongly cannot take work that can still be restored.
test('the purge keeps trash younger than the retention', async () => {
  const set = await trashedSet()

  const sentinel = await expiredSentinel(set.projectId, set.chapterB)
  await setRetentionDays(30)
  await runJob()
  await jobHasRun(sentinel)

  expect(await exists('chapters', set.chapterA)).toBe(true)
  expect(await exists('nodes', set.nodeA)).toBe(true)
  expect(await exists('script_lines', set.lineA)).toBe(true)
  expect(await exists('media', set.mediaA.id)).toBe(true)
  expect(await exists('nodes', set.nodeN)).toBe(true)
  expect(await exists('projects', set.project2)).toBe(true)
  expect((await readAsAdmin('connections', set.connection)).to_node).toBe(set.nodeN)
  expect((await readAsAdmin('projects', set.projectId)).start_node).toBe(set.nodeN)
})

// Protects design 5/6.8: chapters and nodes come back by any member's restore,
// a project only by the owner, and an outsider restores nothing. Also the settings route
// the trash labels read.
test('members restore chapters and nodes and only the owner restores a project', async () => {
  const { owner, member, projectId, chapterId } = await memberProject()
  const outsider = await createUser()
  const nodeId = await createNode(member, projectId, chapterId)
  const chapterB = (
    await (await asUser(member)).collection('chapters').create({ project: projectId, title: 'B', position: 2 })
  ).id

  expect(await setDeletedAt(member, 'nodes', nodeId, new Date().toISOString())).toBe(200)
  expect(await setDeletedAt(member, 'chapters', chapterB, new Date().toISOString())).toBe(200)
  expect(await setDeletedAt(outsider, 'nodes', nodeId, '')).not.toBe(200)
  expect(await storedDeletedAt('nodes', nodeId)).not.toBe('')
  expect(await setDeletedAt(outsider, 'chapters', chapterB, '')).not.toBe(200)
  expect(await storedDeletedAt('chapters', chapterB)).not.toBe('')
  expect(await setDeletedAt(member, 'nodes', nodeId, '')).toBe(200)
  expect(await setDeletedAt(member, 'chapters', chapterB, '')).toBe(200)
  expect(await storedDeletedAt('nodes', nodeId)).toBe('')
  expect(await storedDeletedAt('chapters', chapterB)).toBe('')

  expect(await setDeletedAt(owner, 'projects', projectId, new Date().toISOString())).toBe(200)
  expect(await setDeletedAt(member, 'projects', projectId, '')).not.toBe(200)
  expect(await setDeletedAt(outsider, 'projects', projectId, '')).not.toBe(200)
  expect(await storedDeletedAt('projects', projectId)).not.toBe('')
  expect(await setDeletedAt(owner, 'projects', projectId, '')).toBe(200)
  expect(await storedDeletedAt('projects', projectId)).toBe('')

  const signedIn = await send(await tokenOf(member), '/api/kwnto/app-settings', {})
  expect(signedIn.status).toBe(200)
  expect(signedIn.body).toEqual({ trashRetentionDays: 30, presenceTimeoutSeconds: 30 })
  expect((await rawSend(undefined, '/api/kwnto/app-settings')).status).toBe(401)
})
