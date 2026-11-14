import crypto from 'node:crypto'
import { afterEach, expect, test } from 'vitest'
import { asAdmin, asAnonymous, createUser, type TestUser } from './helpers/pb.ts'
import { onlyRowOf, rowsOf } from './helpers/user-rows.ts'

// Sign-in protection (design 7c, docs/security.md section 3): the lockout after too many
// failed sign-ins, the account block and the system lockdown, built by
// backend/pb_hooks/users-signin.pb.js. An extra file next to users.rules.test.ts.
//
// These tests change global settings (max_failed_logins, lockdown) and restore them in
// afterEach; that is safe only because rule files run one at a time (vitest.config.ts).
// Every test uses a fresh account or email, so their lockout counts never mix.
//
// What these tests cannot show: every request comes from the same IP (the test
// container sees the Docker gateway), so the rule that a lockout applies to one account
// FROM ONE IP (decision D2, Review Focus 3) is pinned by the unit test of decideLockout
// and by the hook's query, not here.

type Failure = { status: number; message: string; body: string }

const WRONG_PASSWORD = 'Wrong-password-9876'
const LOCKOUT_MESSAGE = 'Too many failed sign-in attempts. Try again after 5 minutes.'

// The PocketBase error of a refused request, or a test failure if it was allowed.
async function failureOf(request: Promise<unknown>): Promise<Failure> {
  const error: unknown = await request.then(() => null, (e: unknown) => e)
  expect(error, 'the request was allowed').not.toBeNull()
  const { status, response } = error as { status: number; response: { message: string } }
  return { status, message: response.message, body: JSON.stringify(response) }
}

function signIn(email: string, password: string): Promise<unknown> {
  return asAnonymous().collection('users').authWithPassword(email, password)
}

// Three wrong passwords: each is an ordinary failure (400), not yet a lockout.
async function failThreeTimes(email: string): Promise<void> {
  for (let attempt = 0; attempt < 3; attempt++) {
    expect((await failureOf(signIn(email, WRONG_PASSWORD))).status).toBe(400)
  }
}

async function eventCount(type: string, identity: string): Promise<number> {
  const admin = await asAdmin()
  const filter = admin.filter('type = {:type} && detail.identity = {:identity}', { type, identity })
  return (await admin.collection('security_events').getList(1, 1, { filter })).totalItems
}

async function updateSettings(collection: string, change: Record<string, unknown>): Promise<void> {
  const admin = await asAdmin()
  const record = await admin.collection(collection).getFirstListItem('')
  await admin.collection(collection).update(record.id, change)
}

async function setStatus(user: TestUser, change: Record<string, unknown>): Promise<void> {
  const row = await onlyRowOf('user_status', user.id)
  await (await asAdmin()).collection('user_status').update(row.id, change)
}

afterEach(async () => {
  await updateSettings('system_behavior', { max_failed_logins: 3, lockout_minutes: 5 })
  await updateSettings('system_access', { lockdown: false, lockdown_message: '' })
})

// Protects design 7c: after 3 failed sign-ins the account is refused "for 5 minutes",
// even with the right password, so guessing cannot simply continue.
test('three wrong passwords lock the account, even against the right password', async () => {
  const user = await createUser()
  await failThreeTimes(user.email)

  const locked = await failureOf(signIn(user.email, user.password))
  expect(locked.status).toBe(429)
  expect(locked.message).toBe(LOCKOUT_MESSAGE)
  expect(locked.message).toContain('5 minutes')
})

// Protects Review Focus 3: the lockout must not reveal which emails have an account, so
// an unknown email gets the same failures and the same lockout as a real one.
test('an email with no account gets the same failures and lockout as a real one', async () => {
  const real = await createUser()
  await failThreeTimes(real.email)
  const realLocked = await failureOf(signIn(real.email, WRONG_PASSWORD))

  const unknown = `nobody-${crypto.randomUUID()}@example.test`
  await failThreeTimes(unknown)
  const unknownLocked = await failureOf(signIn(unknown, WRONG_PASSWORD))

  expect(unknownLocked.status).toBe(realLocked.status)
  expect(unknownLocked.message).toBe(realLocked.message)
  expect(unknownLocked.status).toBe(429)
})

// Protects design 7c ("both numbers are admin settings") and engineering 9: the hook
// reads max_failed_logins at sign-in time, so a change applies at once.
test('max_failed_logins is read live: with 2, two wrong passwords lock the account', async () => {
  await updateSettings('system_behavior', { max_failed_logins: 2 })
  const user = await createUser()
  for (let attempt = 0; attempt < 2; attempt++) {
    expect((await failureOf(signIn(user.email, WRONG_PASSWORD))).status).toBe(400)
  }

  expect((await failureOf(signIn(user.email, user.password))).status).toBe(429)
})

// Protects the rule that a lockout ends by itself: attempts refused during a lockout are
// logged as `lockout`, not counted as new failures, so hammering cannot extend it.
test('attempts during a lockout add lockout events, not failures', async () => {
  const user = await createUser()
  await failThreeTimes(user.email)

  expect((await failureOf(signIn(user.email, WRONG_PASSWORD))).status).toBe(429)
  expect((await failureOf(signIn(user.email, user.password))).status).toBe(429)

  expect(await eventCount('failure', user.email)).toBe(3)
  expect(await eventCount('lockout', user.email)).toBe(2)
})

// Protects decision D2: a successful sign-in resets the count for that account and IP,
// so someone who mistypes now and then is never locked out by old mistakes.
test('a successful sign-in resets the failure count', async () => {
  const user = await createUser()
  for (let attempt = 0; attempt < 2; attempt++) await failureOf(signIn(user.email, WRONG_PASSWORD))
  await signIn(user.email, user.password)
  for (let attempt = 0; attempt < 2; attempt++) await failureOf(signIn(user.email, WRONG_PASSWORD))

  await signIn(user.email, user.password)
})

// Protects design 7c (block with a message) and docs/security.md section 3: a blocked
// account is refused with the admin's reason, but only someone who gave the right
// password learns it; a wrong password gets the ordinary failure, with no reason.
test('a blocked account sees the reason only with the right password', async () => {
  const user = await createUser()
  await setStatus(user, { blocked: true, blocked_reason: 'Spamming' })

  const right = await failureOf(signIn(user.email, user.password))
  expect(right.status).toBe(403)
  // PocketBase ends an error message with a full stop when it has none.
  expect(right.message).toBe('Your account is blocked: Spamming.')

  const wrong = await failureOf(signIn(user.email, WRONG_PASSWORD))
  expect(wrong.status).toBe(400)
  expect(wrong.body).not.toContain('Spamming')
  expect(wrong.body).not.toContain('blocked')
})

// Protects the meaning of a failure: a blocked person who keeps giving the right password
// is not guessing, so they keep seeing the block reason and are never locked out.
test('right-password attempts on a blocked account are not counted as failures', async () => {
  const user = await createUser()
  await setStatus(user, { blocked: true, blocked_reason: 'Spamming' })
  for (let attempt = 0; attempt < 4; attempt++) {
    expect((await failureOf(signIn(user.email, user.password))).status).toBe(403)
  }
  expect(await eventCount('failure', user.email)).toBe(0)
})

// Protects design 7c (lockdown) and docs/security.md section 9: during a lockdown every
// app sign-in is refused with the admin's message, but the admin can still sign in to
// the dashboard to end it.
test('a lockdown refuses user sign-ins with its message but not the admin', async () => {
  const user = await createUser()
  await updateSettings('system_access', { lockdown: true, lockdown_message: 'Maintenance' })

  const refused = await failureOf(signIn(user.email, user.password))
  expect(refused.status).toBe(403)
  expect(refused.message).toBe('Maintenance.')

  await asAdmin()
})

// Protects the lockdown fallback: an empty message still tells the person something.
test('a lockdown with no message says sign-in is unavailable', async () => {
  const user = await createUser()
  await updateSettings('system_access', { lockdown: true, lockdown_message: '' })

  const refused = await failureOf(signIn(user.email, user.password))
  expect(refused.status).toBe(403)
  expect(refused.message).toBe('Sign-in is temporarily unavailable.')
})

// Protects docs/security.md section 8: sign-ins and failures are in the security log,
// keyed by the email as typed, lower-cased and trimmed, so "A@x" and "a@x " count as
// the same account and cannot be used to dodge the lockout.
test('a sign-in writes one sign-in event; each wrong attempt one failure event', async () => {
  const user = await createUser()
  await signIn(user.email, user.password)
  expect(await eventCount('sign-in', user.email)).toBe(1)

  await failureOf(signIn(` ${user.email.toUpperCase()} `, WRONG_PASSWORD))
  await failureOf(signIn(user.email, WRONG_PASSWORD))
  expect(await eventCount('failure', user.email)).toBe(2)
  expect(await eventCount('sign-in', user.email)).toBe(1)
})

// Protects the repair promised by Task 2: an account whose user_status row is missing
// gets it back at sign-in, so the block check always has a row to read.
test('a sign-in recreates a missing user_status row', async () => {
  const user = await createUser()
  const row = await onlyRowOf('user_status', user.id)
  await (await asAdmin()).collection('user_status').delete(row.id)
  expect(await rowsOf('user_status', user.id)).toEqual([])

  await signIn(user.email, user.password)

  expect((await onlyRowOf('user_status', user.id)).blocked).toBe(false)
})
