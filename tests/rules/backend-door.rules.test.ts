// Protects the whole chain: door -> routes -> rules, for the flows of Tasks 3 to 8.
import { expect, test } from 'vitest'
import { createBackend } from '../../src/backend/client'
import { PB_URL, asAdmin } from './helpers/pb'

test('sign up, sign in unverified, refresh after verification', async () => {
  const b = createBackend(PB_URL)
  const email = `u9a1_${Date.now()}@test.com`
  await b.auth.signUp(email, 'KwntoPass99', 'Alice')
  const user = await b.auth.signIn(email, 'KwntoPass99')
  expect(user.verified).toBe(false)
  // Admin verifies via PocketBase direct update (simulating the mail flow)
  const admin = await asAdmin()
  const users = admin.collection('users')
  const record = await users.getFirstListItem(`email = '${email}'`)
  await users.update(record.id, { verified: true })
  const refreshed = await b.auth.refresh()
  expect(refreshed?.verified).toBe(true)
})

test('owner create returns isOwner; second user list is empty', async () => {
  const b1 = createBackend(PB_URL)
  const b2 = createBackend(PB_URL)
  const email1 = `u9a2_${Date.now()}@test.com`
  const email2 = `u9a3_${Date.now()}@test.com`
  await b1.auth.signUp(email1, 'KwntoPass99', 'Owner')
  await b1.auth.signIn(email1, 'KwntoPass99')
  await b2.auth.signUp(email2, 'KwntoPass99', 'Member')
  await b2.auth.signIn(email2, 'KwntoPass99')
  // Verify both
  const admin = await asAdmin()
  const users = admin.collection('users')
  for (const email of [email1, email2]) {
    const r = await users.getFirstListItem(`email = '${email}'`)
    await users.update(r.id, { verified: true })
  }
  const team = await b1.teams.create('Crew')
  expect(team.isOwner).toBe(true)
  const list1 = await b1.teams.list()
  expect(list1.length).toBe(1)
  const list2 = await b2.teams.list()
  expect(list2.length).toBe(0)
})

test('settings as owner returns joinCode; as member rejects', async () => {
  const b1 = createBackend(PB_URL)
  const b2 = createBackend(PB_URL)
  const email1 = `u9a4_${Date.now()}@test.com`
  const email2 = `u9a5_${Date.now()}@test.com`
  await b1.auth.signUp(email1, 'KwntoPass99', 'Owner')
  await b1.auth.signIn(email1, 'KwntoPass99')
  await b2.auth.signUp(email2, 'KwntoPass99', 'Member')
  await b2.auth.signIn(email2, 'KwntoPass99')
  const admin = await asAdmin()
  const users = admin.collection('users')
  for (const email of [email1, email2]) {
    const r = await users.getFirstListItem(`email = '${email}'`)
    await users.update(r.id, { verified: true })
  }
  const team = await b1.teams.create('Crew')
  const settings = await b1.teams.settings(team.id)
  expect(settings.joinCode.length).toBe(8)
  const asMember = await b2.teams.settings(team.id).catch((e) => e)
  expect(asMember.kind).toBe('not-found')
})

test('join by code, members, removeMember', async () => {
  const b1 = createBackend(PB_URL)
  const b2 = createBackend(PB_URL)
  const email1 = `u9a6_${Date.now()}@test.com`
  const email2 = `u9a7_${Date.now()}@test.com`
  await b1.auth.signUp(email1, 'KwntoPass99', 'Owner')
  await b1.auth.signIn(email1, 'KwntoPass99')
  await b2.auth.signUp(email2, 'KwntoPass99', 'Member')
  await b2.auth.signIn(email2, 'KwntoPass99')
  const admin = await asAdmin()
  const users = admin.collection('users')
  for (const email of [email1, email2]) {
    const r = await users.getFirstListItem(`email = '${email}'`)
    await users.update(r.id, { verified: true })
  }
  const team = await b1.teams.create('Crew')
  await b1.teams.setJoinCodeEnabled(team.id, true)
  const settings = await b1.teams.settings(team.id)
  const joined = await b2.teams.join(settings.joinCode)
  expect(joined.isOwner).toBe(false)
  const members = await b1.teams.members(team.id)
  expect(members.map((m) => `${m.name}:${m.role}`).sort()).toEqual(['Member:member', 'Owner:owner'])
  const member = members.find((m) => m.name === 'Member')
  expect(member).toBeDefined()
  await b1.teams.removeMember(member!.id)
  const list2 = await b2.teams.list()
  expect(list2.length).toBe(0)
})

test('invite unknown email rejects; invite real user resolves; accept', async () => {
  const b1 = createBackend(PB_URL)
  const b2 = createBackend(PB_URL)
  const email1 = `u9a8_${Date.now()}@test.com`
  const email2 = `u9a9_${Date.now()}@test.com`
  await b1.auth.signUp(email1, 'KwntoPass99', 'Owner')
  await b1.auth.signIn(email1, 'KwntoPass99')
  await b2.auth.signUp(email2, 'KwntoPass99', 'Invitee')
  await b2.auth.signIn(email2, 'KwntoPass99')
  const admin = await asAdmin()
  const users = admin.collection('users')
  for (const email of [email1, email2]) {
    const r = await users.getFirstListItem(`email = '${email}'`)
    await users.update(r.id, { verified: true })
  }
  const team = await b1.teams.create('Crew')
  const unknownErr = b1.teams.invite(team.id, 'nobody@nowhere.com').catch(e => e)
  expect((await unknownErr).kind).toBe('not-found')
  await b1.teams.invite(team.id, email2)
  const invites = await b2.teams.invites()
  expect(invites.length).toBe(1)
  const team2 = await b2.teams.acceptInvite(invites[0].id)
  expect(team2.isOwner).toBe(false)
  // Answered invites stay in the table as history but are no longer offered (final review, I4)
  expect(await b2.teams.invites()).toHaveLength(0)
})

test('a declined invite is no longer offered', async () => {
  const b1 = createBackend(PB_URL)
  const b2 = createBackend(PB_URL)
  const email1 = `u9a8d_${Date.now()}@test.com`
  const email2 = `u9a9d_${Date.now()}@test.com`
  await b1.auth.signUp(email1, 'KwntoPass99', 'Owner')
  await b1.auth.signIn(email1, 'KwntoPass99')
  await b2.auth.signUp(email2, 'KwntoPass99', 'Invitee')
  await b2.auth.signIn(email2, 'KwntoPass99')
  const admin = await asAdmin()
  for (const email of [email1, email2]) {
    const r = await admin.collection('users').getFirstListItem(`email = '${email}'`)
    await admin.collection('users').update(r.id, { verified: true })
  }
  const team = await b1.teams.create('Crew')
  await b1.teams.invite(team.id, email2)
  const [invite] = await b2.teams.invites()
  await b2.teams.declineInvite(invite.id)
  expect(await b2.teams.invites()).toHaveLength(0)
})

// Three wrong passwords are each refused as `invalid` (max_failed_logins is 3); the next
// attempt is refused as `locked` (HTTP 429), even with the right password.
test('three wrong sign-ins -> the next attempt is locked, even for the right password', async () => {
  const b = createBackend(PB_URL)
  const email = `u9a10_${Date.now()}@test.com`
  await b.auth.signUp(email, 'KwntoPass99', 'User')
  await b.auth.signIn(email, 'KwntoPass99')
  const admin = await asAdmin()
  const users = admin.collection('users')
  const r = await users.getFirstListItem(`email = '${email}'`)
  await users.update(r.id, { verified: true })
  for (let attempt = 0; attempt < 3; attempt++) {
    const refused = await b.auth.signIn(email, 'WrongPass').catch(e => e)
    expect(refused.kind).toBe('invalid')
  }
  const rightButLocked = await b.auth.signIn(email, 'KwntoPass99').catch(e => e)
  expect(rightButLocked.kind).toBe('locked')
})

// The door refuses before asking the server (teams.ts); the server's own rule for
// unverified users is pinned in teams.rules.test.ts.
test('the door refuses team creation for an unverified user', async () => {
  const b = createBackend(PB_URL)
  const email = `u9a11_${Date.now()}@test.com`
  await b.auth.signUp(email, 'KwntoPass99', 'User')
  await b.auth.signIn(email, 'KwntoPass99')
  const err = b.teams.create('x').catch(e => e)
  expect((await err).kind).toBe('forbidden')
})

test('signOut makes current null; onChange fires once', async () => {
  const b = createBackend(PB_URL)
  const email = `u9a12_${Date.now()}@test.com`
  await b.auth.signUp(email, 'KwntoPass99', 'User')
  await b.auth.signIn(email, 'KwntoPass99')
  const admin = await asAdmin()
  const users = admin.collection('users')
  const r = await users.getFirstListItem(`email = '${email}'`)
  await users.update(r.id, { verified: true })
  expect(b.auth.current()).not.toBeNull()
  let fired = 0
  const unsub = b.auth.onChange((user) => {
    if (user === null) fired += 1
  })
  b.auth.signOut()
  expect(b.auth.current()).toBeNull()
  expect(fired).toBe(1)
  unsub()
})
