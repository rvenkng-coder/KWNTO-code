import { afterEach, expect, test } from 'vitest'
import { adminSend, asAdmin, asAnonymous, asUser, createUser, rawSend, type TestUser } from './helpers/pb.ts'
import { onlyRowOf } from './helpers/user-rows.ts'

// The admin's incident controls (design 7c, docs/security.md section 9), built by
// backend/pb_hooks/admin-controls.pb.js: signing one account or everyone out, the block
// that ends a user's sessions, and the `admin` log entries for these and for settings
// changes (design 6.9). Not a collection, so no coverage entry: an extra rules file.
//
// "A session works" is checked two ways with the old token: a token refresh, and reading
// the user's own record. A refused refresh alone is not enough, because the sign-in hook
// also refuses a blocked account's refresh while its token would still open other doors.
//
// sign-out-all ends every user session in the test backend; that is safe only because
// rule files run one at a time and every test signs its users in afresh.

type Session = { user: TestUser; token: string }

const BLOCKED_MESSAGE = 'Your account is blocked: Spamming.'

async function signIn(user: TestUser): Promise<Session> {
  return { user, token: (await asUser(user)).authStore.token }
}

function signOutPath(userId: string): string {
  return `/api/kwnto/admin/users/${userId}/sign-out`
}

async function refreshStatus(token: string): Promise<number> {
  return (await rawSend(token, '/api/collections/users/auth-refresh', { method: 'POST' })).status
}

// True when the token still opens a refresh and the user's own record.
async function sessionWorks(session: Session): Promise<boolean> {
  const own = await rawSend(session.token, `/api/collections/users/records/${session.user.id}`)
  return (await refreshStatus(session.token)) === 200 && own.status === 200
}

async function expectEnded(session: Session): Promise<void> {
  expect(await refreshStatus(session.token)).toBe(401)
  expect((await rawSend(session.token, `/api/collections/users/records/${session.user.id}`)).status).not.toBe(200)
}

async function adminEventCount(action: string, userId?: string): Promise<number> {
  const admin = await asAdmin()
  const userPart = userId === undefined ? '' : ' && user = {:user}'
  const filter = admin.filter(`type = 'admin' && detail.action = {:action}${userPart}`, { action, user: userId ?? '' })
  return (await admin.collection('security_events').getList(1, 1, { filter })).totalItems
}

async function setStatus(user: TestUser, change: Record<string, unknown>): Promise<void> {
  const row = await onlyRowOf('user_status', user.id)
  await (await asAdmin()).collection('user_status').update(row.id, change)
}

async function updateOnly(collection: string, change: Record<string, unknown>): Promise<void> {
  const admin = await asAdmin()
  const record = await admin.collection(collection).getFirstListItem('')
  await admin.collection(collection).update(record.id, change)
}

afterEach(async () => {
  await updateOnly('system_behavior', { lockout_minutes: 5 })
  await updateOnly('system_access', { lockdown_message: '' })
  await updateOnly('system_storage', { max_image_mb: 50 })
})

// Protects design 7c incident controls and security.md section 9: signing one account out ends that
// account's existing sessions at once, and only its.
test("sign-out of one user ends that user's sessions and no one else's", async () => {
  const a = await signIn(await createUser())
  const b = await signIn(await createUser())

  const response = await adminSend(signOutPath(a.user.id), { method: 'POST' })
  expect(response.status).toBe(204)

  await expectEnded(a)
  expect(await sessionWorks(b)).toBe(true)
  await asUser(a.user)
})

// Protects design 7c incident controls and security.md section 9: signing everyone out
// ends every user's session, people can sign in again, and the admin stays signed in.
test("sign-out-all ends every user session but not the admin's", async () => {
  const a = await signIn(await createUser())
  const b = await signIn(await createUser())
  const adminToken = (await asAdmin()).authStore.token

  const response = await rawSend(adminToken, '/api/kwnto/admin/sign-out-all', { method: 'POST' })
  expect(response.status).toBe(204)

  await expectEnded(a)
  await expectEnded(b)
  expect(await sessionWorks(await signIn(a.user))).toBe(true)
  expect(await sessionWorks(await signIn(b.user))).toBe(true)
  const adminRefresh = await rawSend(adminToken, '/api/collections/_superusers/auth-refresh', { method: 'POST' })
  expect(adminRefresh.status).toBe(200)
})

// Protects design 7c incident controls and security.md section 9: only the
// admin may end sessions; a signed-out caller, another user and the user themself are
// refused, and nobody's session ends.
test('only the admin can call the sign-out routes', async () => {
  const a = await signIn(await createUser())
  const b = await signIn(await createUser())
  const signedIn = await asUser(b.user)
  const calls: [string | undefined, string][] = [
    [undefined, signOutPath(a.user.id)],
    [undefined, '/api/kwnto/admin/sign-out-all'],
    [b.token, signOutPath(a.user.id)],
    [b.token, '/api/kwnto/admin/sign-out-all'],
    [a.token, signOutPath(a.user.id)],
    [a.token, '/api/kwnto/admin/sign-out-all'],
  ]

  for (const [token, path] of calls) {
    expect([401, 403], `${token === undefined ? 'anonymous' : 'user'} ${path}`).toContain(
      (await rawSend(token, path, { method: 'POST' })).status,
    )
  }
  for (const path of [signOutPath(a.user.id), '/api/kwnto/admin/sign-out-all']) {
    const error: unknown = await signedIn.send(path, { method: 'POST' }).then(
      () => null,
      (e: unknown) => e,
    )
    expect([401, 403]).toContain((error as { status?: number } | null)?.status)
    const anonymous: unknown = await asAnonymous()
      .send(path, { method: 'POST' })
      .then(
        () => null,
        (e: unknown) => e,
      )
    expect([401, 403]).toContain((anonymous as { status?: number } | null)?.status)
  }

  expect(await sessionWorks(a)).toBe(true)
  expect(await sessionWorks(b)).toBe(true)
})

// Protects design 7c incident controls and security.md section 9: blocking an account ends the
// sessions it already has, not only the next sign-in.
test('blocking a user ends their sessions; unblocking lets them sign in again', async () => {
  const a = await signIn(await createUser())

  await setStatus(a.user, { blocked: true, blocked_reason: 'Spamming' })

  expect([401, 403]).toContain(await refreshStatus(a.token))
  expect((await rawSend(a.token, `/api/collections/users/records/${a.user.id}`)).status).not.toBe(200)
  const refused: unknown = await asUser(a.user).then(
    () => null,
    (e: unknown) => e,
  )
  expect((refused as { status?: number } | null)?.status).toBe(403)
  expect((refused as { response: { message: string } }).response.message).toBe(BLOCKED_MESSAGE)

  await setStatus(a.user, { blocked: false })
  expect(await sessionWorks(await signIn(a.user))).toBe(true)
})

// Protects design 7c incident controls and security.md section 9: an unknown account id
// is reported as not found, not as a sign-out that happened.
test('sign-out of an unknown user id returns 404', async () => {
  const response = await adminSend(signOutPath('nosuchuser1234'), { method: 'POST' })
  expect(response.status).toBe(404)
  expect(((await response.json()) as { message: string }).message).toBe('No account with this id.')
})

// Protects design 7c incident controls, design 6.9 and security.md sections 8 and 9:
// each incident action leaves exactly one `admin` entry in the security log.
test('each sign-out and each block writes one admin event', async () => {
  const a = await signIn(await createUser())
  const b = await createUser()
  const allBefore = await adminEventCount('sign-out-all')

  await adminSend(signOutPath(a.user.id), { method: 'POST' })
  expect(await adminEventCount('sign-out-user', a.user.id)).toBe(1)

  await adminSend('/api/kwnto/admin/sign-out-all', { method: 'POST' })
  expect(await adminEventCount('sign-out-all')).toBe(allBefore + 1)

  await setStatus(b, { blocked: true, blocked_reason: 'Spamming' })
  expect(await adminEventCount('block', b.id)).toBe(1)
  // Changing only the reason of an account already blocked is not a second block.
  await setStatus(b, { blocked_reason: 'Spamming again' })
  expect(await adminEventCount('block', b.id)).toBe(1)
})

type SettingsDetail = {
  action: string
  collection: string
  record: string
  changes: Record<string, { old: unknown; new: unknown }>
}

async function settingsEvents(collection: string): Promise<SettingsDetail[]> {
  const admin = await asAdmin()
  const filter = admin.filter("type = 'admin' && detail.action = 'settings' && detail.collection = {:c}", {
    c: collection,
  })
  const rows = await admin.collection('security_events').getFullList({ filter, sort: '-created' })
  return rows.map((row) => row.detail as SettingsDetail)
}

// Protects design 6.9 (admin changes are logged) and security.md sections 8 and 9: a
// change to a settings table or a user's limits or status records which fields changed,
// with the old and new values (these tables hold no secrets).
test('settings changes write one admin event with the changed fields', async () => {
  const user = await createUser()
  const limits = await onlyRowOf('user_limits', user.id)
  const status = await onlyRowOf('user_status', user.id)
  const cases: [string, () => Promise<void>, Record<string, { old: unknown; new: unknown }>][] = [
    [
      'system_behavior',
      () => updateOnly('system_behavior', { lockout_minutes: 7 }),
      { lockout_minutes: { old: 5, new: 7 } },
    ],
    [
      'system_access',
      () => updateOnly('system_access', { lockdown_message: 'Soon back' }),
      { lockdown_message: { old: '', new: 'Soon back' } },
    ],
    [
      'system_storage',
      () => updateOnly('system_storage', { max_image_mb: 51 }),
      { max_image_mb: { old: 50, new: 51 } },
    ],
    [
      'user_limits',
      async () => {
        await (await asAdmin()).collection('user_limits').update(limits.id, { quota_override_bytes: 1000 })
      },
      { quota_override_bytes: { old: 0, new: 1000 } },
    ],
    [
      'user_status',
      async () => {
        await (await asAdmin()).collection('user_status').update(status.id, { blocked_reason: 'Watch' })
      },
      { blocked_reason: { old: '', new: 'Watch' } },
    ],
  ]

  for (const [collection, change, expected] of cases) {
    const before = (await settingsEvents(collection)).length
    await change()
    const events = await settingsEvents(collection)
    expect(events.length, collection).toBe(before + 1)
    expect(events[0]?.changes, collection).toEqual(expected)
  }
})
