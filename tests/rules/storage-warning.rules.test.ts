import { afterEach, beforeEach, expect, test } from 'vitest'
import { createNode, memberProject } from './helpers/content.ts'
import { PNG_1PX, setStorageSetting, uploadMedia } from './helpers/media.ts'
import { asAdmin } from './helpers/pb.ts'

// Protects design 7c and plan D12: the hourly kwnto_storage_check job adds up every
// stored file and, over the admin's total limit, writes one `storage` log entry (and
// mails the admins when mail is set up) at most once a day; limit 0 turns it off.
// The job is run on demand through the admin API. PocketBase answers a triggered job at
// once and runs it in the background, so the tests poll or wait before they count.
// Rule files run one at a time (vitest.config.ts), so clearing media and `storage`
// entries here cannot disturb another file.

const JOB = 'kwnto_storage_check'
let restore: (() => Promise<void>) | null = null

async function storageEntries(): Promise<number> {
  const admin = await asAdmin()
  return (await admin.collection('security_events').getList(1, 1, { filter: "type = 'storage'" })).totalItems
}

async function clearAll(): Promise<void> {
  const admin = await asAdmin()
  for (const collection of ['media', 'security_events']) {
    const filter = collection === 'media' ? '' : "type = 'storage'"
    for (const row of await admin.collection(collection).getFullList({ filter })) {
      await admin.collection(collection).delete(row.id)
    }
  }
}

beforeEach(clearAll)
afterEach(async () => {
  await restore?.()
  restore = null
  await clearAll()
})

test('over the total limit the admin is warned once', async () => {
  restore = await setStorageSetting('total_warning_bytes', 100)
  const { owner, projectId, chapterId } = await memberProject()
  const nodeId = await createNode(owner, projectId, chapterId)
  const bytes = new Uint8Array(200)
  bytes.set(PNG_1PX)
  const uploaded = await uploadMedia(owner, { project: projectId, node: nodeId }, { name: 'big.png', bytes })
  expect(uploaded.status).toBe(200)

  const admin = await asAdmin()
  await admin.crons.run(JOB)
  await expect.poll(storageEntries, { message: 'no warning was logged', timeout: 5000 }).toBe(1)

  // The second run is inside the 24 hours, so it must add nothing; give it time to finish.
  await admin.crons.run(JOB)
  await new Promise((resolve) => setTimeout(resolve, 1500))
  expect(await storageEntries()).toBe(1)

  const entry = await admin.collection('security_events').getFirstListItem("type = 'storage'")
  expect(entry.detail.usedBytes).toBeGreaterThanOrEqual(200)
  expect(entry.detail.limitBytes).toBe(100)
})

test('no warning under the limit or when it is off', async () => {
  const { owner, projectId, chapterId } = await memberProject()
  const nodeId = await createNode(owner, projectId, chapterId)
  const bytes = new Uint8Array(200)
  bytes.set(PNG_1PX)
  expect((await uploadMedia(owner, { project: projectId, node: nodeId }, { name: 'big.png', bytes })).status).toBe(200)
  const admin = await asAdmin()

  // Off: 0 means no warning, however much is stored.
  restore = await setStorageSetting('total_warning_bytes', 0)
  await admin.crons.run(JOB)
  await new Promise((resolve) => setTimeout(resolve, 1500))
  expect(await storageEntries()).toBe(0)
  await restore()

  // The default (20 GB) is far above a 200 byte file. restore() put back the migration's value.
  const record = await admin.collection('system_storage').getFirstListItem('')
  expect(record.total_warning_bytes).toBe(21474836480)
  await admin.crons.run(JOB)
  await new Promise((resolve) => setTimeout(resolve, 1500))
  expect(await storageEntries()).toBe(0)
  restore = null
})

// Protects the failure mode in plan D12: mail is set up but cannot be sent (here, nothing
// listens on the port). The warning is already in the log and must stay one entry; the
// job logs the mail failure to the server console instead of throwing.
test('a mail that cannot be sent does not undo the warning', async () => {
  const admin = await asAdmin()
  const before = await admin.settings.getAll()
  restore = await setStorageSetting('total_warning_bytes', 100)
  const restoreLimit = restore
  restore = async () => {
    await admin.settings.update({ smtp: before.smtp })
    await restoreLimit()
  }
  await admin.settings.update({ smtp: { ...before.smtp, enabled: true, host: '127.0.0.1', port: 1, tls: false } })

  const { owner, projectId, chapterId } = await memberProject()
  const nodeId = await createNode(owner, projectId, chapterId)
  const bytes = new Uint8Array(200)
  bytes.set(PNG_1PX)
  expect((await uploadMedia(owner, { project: projectId, node: nodeId }, { name: 'big.png', bytes })).status).toBe(200)

  await admin.crons.run(JOB)
  await expect.poll(storageEntries, { message: 'no warning was logged', timeout: 5000 }).toBe(1)
  await new Promise((resolve) => setTimeout(resolve, 1500))
  expect(await storageEntries()).toBe(1)
})
