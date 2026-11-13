import crypto from 'node:crypto'
import type PocketBase from 'pocketbase'
import { afterEach, expect, test } from 'vitest'
import { asAdmin, asAnonymous, asUser, createUser, signUp } from './helpers/pb.ts'

// Sign-up, the verified flag and the password rules (design 7c, docs/security.md
// section 3). An extra file next to users.rules.test.ts: the coverage check needs only
// that one, these pin the users-signup hook and the 1794360300 password migration.
// Rule files run one at a time (vitest.config.ts), so changing registration_open here
// cannot disturb another file.

const GOOD_PASSWORD = 'Signup-password-2468'

type Failure = { status: number; message: string; data: Record<string, { code?: string; message?: string }> }

function newEmail(): string {
  return `signup-${crypto.randomUUID()}@example.test`
}

// The PocketBase error of a refused request, or a test failure if it was allowed.
async function failureOf(request: Promise<unknown>): Promise<Failure> {
  const error: unknown = await request.then(() => null, (e: unknown) => e)
  expect(error, 'the request was allowed').not.toBeNull()
  const { status, response } = error as { status: number; response: { message: string; data: Failure['data'] } }
  return { status, message: response.message, data: response.data }
}

async function setRegistrationOpen(open: boolean): Promise<void> {
  const admin = await asAdmin()
  const record = await admin.collection('system_access').getFirstListItem('')
  await admin.collection('system_access').update(record.id, { registration_open: open })
}

async function signupEvents(admin: PocketBase, userId?: string): Promise<number> {
  const filter = userId
    ? admin.filter('type = "signup" && user = {:user}', { user: userId })
    : 'type = "signup"'
  return (await admin.collection('security_events').getList(1, 1, { filter })).totalItems
}

afterEach(async () => {
  await setRegistrationOpen(true)
})

// Protects design 7c: anyone may sign up, and a new account starts unverified, so the
// verified-only actions (teams, uploads, sign-in share links) wait for the email check.
test('sign-up with a good password succeeds and the account is not verified', async () => {
  const { id } = await signUp(newEmail(), GOOD_PASSWORD)
  const stored = await (await asAdmin()).collection('users').getOne(id)
  expect(stored.verified).toBe(false)
})

// Protects Review Focus 1: a visitor who sends `verified: true` must not skip the email
// check. Refusing the request and storing `false` are both safe; the stored value is
// what matters, read as the admin.
test('a sign-up that sends verified: true does not get a verified account', async () => {
  const email = newEmail()
  const outcome = await signUp(email, GOOD_PASSWORD, { verified: true }).catch((e: unknown) => e)
  const admin = await asAdmin()
  if (outcome instanceof Error) {
    expect([400, 403]).toContain((outcome as { status?: number }).status)
    const made = await admin.collection('users').getList(1, 1, { filter: admin.filter('email = {:email}', { email }) })
    expect(made.totalItems).toBe(0)
    return
  }
  expect((await admin.collection('users').getOne(outcome.id)).verified).toBe(false)
})

// Protects docs/security.md section 3 and the router's Global Constraints: emails are
// private to everyone except the admin. A visitor who signs up with
// `emailVisibility: true` must still get a private email, or teammates (who will see
// each other's user records from Task 6) would read it.
test('a sign-up that sends emailVisibility: true stores a private email', async () => {
  const { id } = await signUp(newEmail(), GOOD_PASSWORD, { emailVisibility: true })
  expect((await (await asAdmin()).collection('users').getOne(id)).emailVisibility).toBe(false)
})

// Protects the same rule after sign-up: a signed-in user cannot make their own email
// public by editing their record.
test('a user cannot make their own email public', async () => {
  const user = await createUser()
  const pb = await asUser(user)
  await pb.collection('users').update(user.id, { emailVisibility: true })
  expect((await (await asAdmin()).collection('users').getOne(user.id)).emailVisibility).toBe(false)
})

// Protects docs/security.md section 3 on sign-up: the hook's rules, with its message,
// not only PocketBase's own length check.
test('sign-up with a short or common password is refused with the rule message', async () => {
  const short = await failureOf(signUp(newEmail(), 'short1'))
  expect(short.status).toBe(400)
  expect(short.message).toBe('Use at least 10 characters.')
  expect(short.data.password?.message).toBe('Use at least 10 characters.')

  const common = await failureOf(signUp(newEmail(), 'Password123'))
  expect(common.status).toBe(400)
  expect(common.message).toBe('That password is too common.')
})

// Protects Review Focus 2: the password rules hold when a signed-in user changes their
// password, not only at sign-up.
test('a password change must follow the password rules', async () => {
  const user = await createUser()
  const pb = await asUser(user)
  const change = (password: string) => pb.collection('users').update(user.id, {
    oldPassword: user.password,
    password,
    passwordConfirm: password,
  })

  const short = await failureOf(change('short1'))
  expect(short.status).toBe(400)
  expect(short.message).toBe('Use at least 10 characters.')

  const common = await failureOf(change('Password123'))
  expect(common.status).toBe(400)
  expect(common.message).toBe('That password is too common.')

  await change(GOOD_PASSWORD)
  await asUser({ ...user, password: GOOD_PASSWORD })
})

// Protects design 7c and docs/security.md section 9 step 5: the admin can close sign-up;
// people who already have an account keep signing in, and the admin can still add one.
test('with registration closed, sign-up is refused but existing users still sign in', async () => {
  const existing = await createUser()
  await setRegistrationOpen(false)

  const refused = await failureOf(signUp(newEmail(), GOOD_PASSWORD))
  expect(refused.status).toBe(403)
  expect(refused.message).toBe('Sign-up is closed.')

  await asUser(existing)
  await asUser(await createUser())
})

// Protects docs/security.md section 8: every sign-up is in the security log, and a
// refused attempt does not leave an entry that looks like an account was made.
test('a successful sign-up writes one signup event; a refused one writes none', async () => {
  const admin = await asAdmin()
  const { id } = await signUp(newEmail(), GOOD_PASSWORD)
  expect(await signupEvents(admin, id)).toBe(1)

  const before = await signupEvents(admin)
  await failureOf(signUp(newEmail(), 'short1'))
  await setRegistrationOpen(false)
  await failureOf(signUp(newEmail(), GOOD_PASSWORD))
  expect(await signupEvents(admin)).toBe(before)
})

// Protects deny by default: the only public rule on users is still the open create
// (also checked by coverage.rules.test.ts), so a signed-out visitor cannot read accounts.
// Developer decision 2026-11-13: emails are not case-sensitive. They are stored
// lower-case and trimmed, and the database refuses a case variant on every path
// (1794360600_users_email_nocase.js), so a look-alike account cannot exist.
test('sign-up stores the email lower-case and trimmed; a case variant is refused', async () => {
  const email = newEmail()
  const created = await signUp(` ${email.toUpperCase()} `, GOOD_PASSWORD)
  const admin = await asAdmin()
  expect((await admin.collection('users').getOne(created.id)).email).toBe(email)

  const variant = await failureOf(signUp(email.replace('signup-', 'Signup-'), GOOD_PASSWORD))
  expect(variant.status).toBe(400)
  const again = await failureOf(signUp(email, GOOD_PASSWORD))
  expect(again.status).toBe(400)
})

test('an account made by the admin with capitals is stored lower-case, and the email cannot be changed to a case variant', async () => {
  const admin = await asAdmin()
  const email = newEmail()
  const first = await admin.collection('users').create({ email: email.toUpperCase(), password: GOOD_PASSWORD, passwordConfirm: GOOD_PASSWORD })
  expect(first.email).toBe(email)
  const other = await createUser()
  const clash = await failureOf(admin.collection('users').update(other.id, { email: email.toUpperCase() }))
  expect(clash.status).toBe(400)
})

test('sign-in works whatever the case of the typed email', async () => {
  const user = await createUser()
  const client = asAnonymous()
  const auth = await client.collection('users').authWithPassword(` ${user.email.toUpperCase()} `, user.password)
  expect(auth.record.id).toBe(user.id)
})

test('users.createRule is the only public users rule', async () => {
  const users = await (await asAdmin()).collections.getOne('users')
  expect(users.createRule).toBe('')
  for (const rule of [users.listRule, users.viewRule, users.updateRule, users.deleteRule]) {
    expect(rule).not.toBe('')
  }
  expect((await asAnonymous().collection('users').getList(1, 1)).totalItems).toBe(0)
})
