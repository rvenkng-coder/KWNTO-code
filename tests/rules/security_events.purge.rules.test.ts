import { afterEach, expect, test } from 'vitest'
import { asAdmin } from './helpers/pb.ts'

// Protects design 6.9 end to end: the daily purge_security_events job removes log
// entries older than system_behavior.security_retention_days and keeps the others.
// security_events.rules.test.ts only pins that the job is registered; this runs it.
//
// The API cannot backdate an entry (`created` is set by the server and ignored in a
// request), and retention is counted in whole days, so the test moves the cut-off
// instead: with the default 365 days a fresh entry is inside the window and must stay;
// with 0 days the cut-off is the moment the job runs, so the same entry is now "older
// than the retention period" and must go. Run as the admin through PocketBase's own
// "run cron job" endpoint. Rule files run one at a time (vitest.config.ts), so the
// changed setting and the deleted entries cannot disturb another file.

const JOB = 'purge_security_events'
let restoreDays: (() => Promise<void>) | undefined

async function setRetentionDays(days: number): Promise<void> {
  const admin = await asAdmin()
  const record = await admin.collection('system_behavior').getFirstListItem('')
  const previous = record.security_retention_days as number
  restoreDays ??= async () => {
    await admin.collection('system_behavior').update(record.id, { security_retention_days: previous })
  }
  await admin.collection('system_behavior').update(record.id, { security_retention_days: days })
}

afterEach(async () => {
  await restoreDays?.()
  restoreDays = undefined
})

async function entryExists(id: string): Promise<boolean> {
  const admin = await asAdmin()
  const found = await admin.collection('security_events').getList(1, 1, { filter: admin.filter('id = {:id}', { id }) })
  return found.totalItems === 1
}

test('security_events: the purge keeps entries inside the retention period and removes older ones', async () => {
  const admin = await asAdmin()
  const entry = await admin.collection('security_events').create({ type: 'admin', ip: '203.0.113.9', detail: { note: 'purge test' } })

  await setRetentionDays(365)
  await admin.crons.run(JOB)
  expect(await entryExists(entry.id), 'an entry inside the retention period was purged').toBe(true)

  // PocketBase runs a triggered job in the background and answers at once (apis/cron.go,
  // routine.FireAndForget), so wait for the delete instead of checking straight away.
  await setRetentionDays(0)
  await admin.crons.run(JOB)
  await expect.poll(() => entryExists(entry.id), { message: 'an entry older than the retention period was kept', timeout: 5000 }).toBe(false)
})
