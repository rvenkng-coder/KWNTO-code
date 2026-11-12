import crypto from 'node:crypto'
import { afterEach, expect, test } from 'vitest'
import { asAdmin, asUser, createTeam, createUser, type TestUser } from './helpers/pb.ts'
import { addMember, expectNoEmail, memberRow, teamRows } from './helpers/teams.ts'
import {
  accept, eventsOf, invite, invitePath, invitesOf, namedUser, onlyInviteOf, send, setAttemptsPerHour, setVerified,
  unverifiedUser,
} from './helpers/invites.ts'

// Inviting by email (design 5; docs/security.md section 3), built by
// backend/pb_hooks/teams-invites.pb.js: `POST /api/kwnto/teams/{id}/invites`. The owner
// learns only whether an account exists (the accepted, rate-limited and logged
// enumeration risk), never the invitee's email or anything else about them, and sees
// no trace of a pending invitee anywhere (decision D7, Review Focus 5). Not a
// collection, so no coverage entry; answering invites, the shared attempt limit and the
// log are in teams.invites-answer.rules.test.ts.
//
// Every test uses fresh users, so the default limit of 20 attempts per user is never
// reached; afterEach restores it anyway in case a test changed it.

const NO_USER = "That user doesn't exist."
const ALREADY = 'That person is already a member or has a pending invite.'

afterEach(async () => {
  await setAttemptsPerHour(20)
})

async function ownerWithTeam(): Promise<{ owner: TestUser; teamId: string }> {
  const owner = await namedUser('Olive Owner')
  const team = await createTeam(owner, 'Drama 101')
  return { owner, teamId: team.id }
}

// Design 5, the whole flow: the owner types an existing person's email, the invite
// appears in that person's account with the team and inviter names (D6 copies) and no
// email; accepting makes them a plain member, with their name copied for teammates
// (Task 6 hook), who can now see the team; the invite is marked accepted.
test('invite: the owner invites an existing user, who sees the invite, accepts and becomes a member', async () => {
  const { owner, teamId } = await ownerWithTeam()
  const invitee = await namedUser('Ivy Invitee')

  const sent = await invite(owner, teamId, invitee.email)

  expect(sent.status).toBe(204)
  const listed = await (await asUser(invitee)).collection('team_invites').getFullList()
  expect(listed).toHaveLength(1)
  expect(listed[0]).toMatchObject({ team: teamId, status: 'pending', team_name: 'Drama 101', invited_by_name: 'Olive Owner' })
  expectNoEmail(listed)

  const accepted = await accept(invitee, listed[0].id)

  expect(accepted.status).toBe(200)
  expect(accepted.body).toEqual({ team: teamId, name: 'Drama 101' })
  const row = await memberRow(teamId, invitee.id)
  expect(row.role).toBe('member')
  expect(row.user_name).toBe('Ivy Invitee')
  expect((await (await asUser(invitee)).collection('teams').getOne(teamId)).name).toBe('Drama 101')
  expect((await onlyInviteOf(invitee)).status).toBe('accepted')
})

// Review Focus 5 and D7: the invite answer (body and headers) holds no email; before
// acceptance the owner finds no trace of the invitee (id, email or name) in ANY
// collection they can read; after it, the owner's member list shows the name only.
test('invite: the owner never sees the invitee\'s email, and sees nothing of them before they accept', async () => {
  const { owner, teamId } = await ownerWithTeam()
  const invitee = await namedUser('Ivy Invitee')

  const sent = await invite(owner, teamId, invitee.email)
  expect(sent.status).toBe(204)
  expect(sent.raw).not.toContain(invitee.email)
  expect(sent.raw).not.toContain('@')

  const asOwner = await asUser(owner)
  const collections = await (await asAdmin()).collections.getFullList()
  let readable = 0
  for (const collection of collections) {
    const rows = await asOwner.collection(collection.name).getFullList().catch(() => null)
    if (rows === null) continue
    readable += 1
    const text = JSON.stringify(rows)
    for (const trace of [invitee.id, invitee.email, 'Ivy Invitee']) {
      expect(text, `${collection.name} shows the pending invitee`).not.toContain(trace)
    }
  }
  expect(readable).toBeGreaterThanOrEqual(4) // users, teams, team_members, team_settings at least

  expect((await accept(invitee, (await onlyInviteOf(invitee)).id)).status).toBe(200)
  const members = await asOwner.collection('team_members').getFullList({ filter: asOwner.filter('team = {:t}', { t: teamId }) })
  expect(members.map((m) => m.user_name).sort()).toEqual(['Ivy Invitee', 'Olive Owner'])
  expectNoEmail(members)
})

// Design 5: if no account exists the owner sees "that user doesn't exist" (the accepted
// enumeration risk). Emails are typed by hand, so the lookup ignores letter case and
// stray spaces, in both directions (typed in capitals; stored with capitals).
test('invite: an unknown email gives 404 "That user doesn\'t exist."; letter case and spaces do not matter', async () => {
  const { owner, teamId } = await ownerWithTeam()
  const invitee = await createUser()
  const mixed = `Mixed-${crypto.randomUUID()}@Example.TEST`
  const admin = await asAdmin()
  const stored = await admin.collection('users').create({ email: mixed, password: 'Test-password-1234', passwordConfirm: 'Test-password-1234', verified: true })

  const unknown = await invite(owner, teamId, `nobody-${crypto.randomUUID()}@example.test`)
  const typedUpper = await invite(owner, teamId, `  ${invitee.email.toUpperCase()}  `)
  const typedLower = await invite(owner, teamId, mixed.toLowerCase())

  expect(unknown.status).toBe(404)
  expect(unknown.body?.message).toBe(NO_USER)
  expect(typedUpper.status).toBe(204)
  expect(await invitesOf(invitee)).toHaveLength(1)
  expect(typedLower.status).toBe(204)
  expect(await invitesOf({ id: stored.id, email: mixed, password: '' })).toHaveLength(1)
})

// A missing or malformed email, or a filter-injection string, is just an email no
// account has: the same 404, and no invite for anyone (the lookup binds the value).
test('invite: missing, malformed and injected emails give the same 404 and invite nobody', async () => {
  const { owner, teamId } = await ownerWithTeam()
  await createUser() // an account exists, so an injection that matched "any row" would invite it
  const token = (await asUser(owner)).authStore.token

  const replies = [
    await invite(owner, teamId, ''),
    await invite(owner, teamId, 42),
    await send(token, invitePath(teamId), { method: 'POST' }),
    await invite(owner, teamId, "' OR 1=1 --"),
    await invite(owner, teamId, '%@example.test'),
  ]

  for (const reply of replies) {
    expect(reply.status).toBe(404)
    expect(reply.body).toEqual(replies[0].body)
  }
  expect(replies[0].body?.message).toBe(NO_USER)
  expect(await teamRows('team_invites', teamId)).toHaveLength(0)
})

// Security.md section 2: only the owner invites. A plain member is told no (403);
// anyone outside the team, the owner of ANOTHER team included, and an unknown team id
// get the same 404, so team ids do not leak. Verified email is required (403) and a
// signed-out caller gets 401. Nobody gets an invite from any of these.
test('invite: a member gets 403; an outsider, another team\'s owner and an unknown id 404; unverified 403; signed-out 401', async () => {
  const { owner, teamId } = await ownerWithTeam()
  const [member, outsider, otherOwner, invitee] = [await createUser(), await createUser(), await createUser(), await createUser()]
  await addMember(teamId, member)
  const otherTeam = await createTeam(otherOwner)

  const asMember = await invite(member, teamId, invitee.email)
  const asOutsider = await invite(outsider, teamId, invitee.email)
  const asOtherOwner = await invite(otherOwner, teamId, invitee.email)
  const unknownTeam = await invite(outsider, 'nonexistent0000', invitee.email)
  await setVerified(owner, false)
  const unverifiedOwner = await invite(owner, teamId, invitee.email)
  const signedOut = await send(undefined, invitePath(teamId), { method: 'POST', body: { email: invitee.email } })

  expect(asMember.status).toBe(403)
  for (const reply of [asOutsider, asOtherOwner, unknownTeam]) {
    expect(reply.status).toBe(404)
    expect(reply.body).toEqual(asOutsider.body)
  }
  expect(unverifiedOwner.status).toBe(403)
  expect(signedOut.status).toBe(401)
  expect(await invitesOf(invitee)).toHaveLength(0)
  expect(await teamRows('team_invites', otherTeam.id)).toHaveLength(0)
  expect((await teamRows('team_members', teamId)).length).toBe(2)
})

// Design 5: an invite is for someone not yet in the team, once. Inviting a member (the
// owner included) or someone with a pending invite from this team gives 409 and makes
// no new row. A pending invite from ANOTHER team does not block this one.
test('invite: a member or a person with a pending invite from this team gives 409 and no new row', async () => {
  const { owner, teamId } = await ownerWithTeam()
  const [member, invitee, otherOwner] = [await createUser(), await createUser(), await createUser()]
  await addMember(teamId, member)
  const otherTeam = await createTeam(otherOwner)
  expect((await invite(otherOwner, otherTeam.id, invitee.email)).status).toBe(204)
  expect((await invite(owner, teamId, invitee.email)).status).toBe(204)

  const replies = [
    await invite(owner, teamId, member.email),
    await invite(owner, teamId, owner.email),
    await invite(owner, teamId, invitee.email),
  ]

  for (const reply of replies) {
    expect(reply.status).toBe(409)
    expect(reply.body?.message).toBe(ALREADY)
    expect(reply.raw).not.toContain('@')
  }
  expect(await teamRows('team_invites', teamId)).toHaveLength(1)
  expect(await invitesOf(member)).toHaveLength(0)
  expect(await invitesOf(invitee)).toHaveLength(2)
})

// Only verified accounts may invite or answer, and a signed-out visitor cannot reach the
// routes; such refusals are not attempts on anyone's limit, so they are not logged (as
// for join, Task 7).
test('invite: unverified and signed-out calls write no invite event', async () => {
  const { teamId } = await ownerWithTeam()
  const unverified = await unverifiedUser()
  const invitee = await createUser()

  expect((await invite(unverified, teamId, invitee.email)).status).toBe(403)
  expect((await send(undefined, invitePath(teamId), { method: 'POST', body: { email: invitee.email } })).status).toBe(401)

  expect(await eventsOf(unverified, 'invite')).toHaveLength(0)
  const anonymousEvents = await (await asAdmin()).collection('security_events').getFullList({ filter: "type = 'invite' && user = ''" })
  expect(anonymousEvents).toHaveLength(0)
})
