import { expect, test } from 'vitest'
import { adminOnlyTests, expectNoRows, expectRefused } from './helpers/admin-only.ts'
import { asAdmin, asUser, createUser } from './helpers/pb.ts'

// Protects design 6.9 and docs/security.md section 8: the security log is admin only.
// It holds IPs and account activity, so no app user may read it, and no client may
// write it: entries come from server hooks, never from the public API.

// Stands in for an entry a hook writes: made on the server side, not by an app user.
async function serverWrittenEvent(): Promise<string> {
  const admin = await asAdmin()
  const event = await admin.collection('security_events').create({
    type: 'admin',
    ip: '203.0.113.7',
    detail: { note: 'rule test' },
  })
  return event.id
}

adminOnlyTests('security_events', { type: 'admin', ip: '198.51.100.1', detail: {} }, serverWrittenEvent)

test('security_events: an entry written by the server is visible to the admin only', async () => {
  const id = await serverWrittenEvent()
  const admin = await asAdmin()
  expect((await admin.collection('security_events').getOne(id)).ip).toBe('203.0.113.7')

  const user = await asUser(await createUser())
  await expectRefused(user.collection('security_events').getOne(id))
  await expectNoRows(user, 'security_events', user.filter('id = {:id}', { id }))
})

// Protects: a user must not forge log entries (for example a fake sign-in to cover a
// trail, or failures that lock another account out). Events come only from hooks.
test('security_events: a user cannot create an entry through the public API', async () => {
  const someone = await createUser()
  const user = await asUser(someone)
  const marker = `forged-${crypto.randomUUID()}`
  await expectRefused(user.collection('security_events').create({ type: 'sign-in', user: someone.id, ip: marker, detail: {} }))

  const admin = await asAdmin()
  const forged = await admin.collection('security_events').getList(1, 1, { filter: admin.filter('ip = {:ip}', { ip: marker }) })
  expect(forged.totalItems).toBe(0)
})

// Protects design 6.9: deleting an account must not erase its history from the log
// (the user relation has no cascade delete), or an attacker could cover their tracks.
test('security_events: deleting a user keeps their entries', async () => {
  const someone = await createUser()
  const admin = await asAdmin()
  const event = await admin.collection('security_events').create({ type: 'sign-in', user: someone.id, ip: '203.0.113.8', detail: {} })
  await admin.collection('users').delete(someone.id)
  const kept = await admin.collection('security_events').getOne(event.id)
  expect(kept.ip).toBe('203.0.113.8')
  expect(kept.user).toBe('')
})

// Protects design 6.9: retention is enforced. The daily purge job must be registered,
// or the log would grow forever and keep personal data past the admin's setting.
test('security_events: the daily purge job is registered', async () => {
  const admin = await asAdmin()
  const jobs = await admin.crons.getFullList()
  expect(jobs).toContainEqual({ id: 'purge_security_events', expression: '0 3 * * *' })
})
