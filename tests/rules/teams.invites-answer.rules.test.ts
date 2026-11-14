import { afterEach, expect, test } from 'vitest'
import { asAdmin, asUser, createTeam, createUser, type TestUser } from './helpers/pb.ts'
import { addMember, memberRow, teamRows } from './helpers/teams.ts'
import {
  accept, decline, eventsOf, invite, invitesOf, joinByCode, onlyInviteOf, send, setAttemptsPerHour, setVerified, tokenOf,
  TOO_MANY, unverifiedUser,
} from './helpers/invites.ts'

// Answering invites, the shared attempt limit and the invite log (design 5; docs/security.md
// sections 3 and 8), built by backend/pb_hooks/teams-invites.pb.js:
// `POST /api/kwnto/invites/{id}/accept` and `.../decline`. Only the invited person can
// answer (Review Focus 5: nobody adds someone else, or themselves, to a team), an
// invite is answered once, and every invite attempt is logged without the address.
// Sending invites is in teams.invites.rules.test.ts.
//
// The rate-limit tests change `team_attempts_per_hour` and restore it in afterEach; safe
// only because rule files run one at a time (vitest.config.ts).

const NO_INVITE = 'No invite with this id.'
const ANSWERED = 'This invite has already been answered.'

afterEach(async () => {
  await setAttemptsPerHour(20)
})

// A team, and a pending invite for a fresh verified user (or the given one).
async function pendingInvite(invitee?: TestUser): Promise<{ owner: TestUser; teamId: string; invitee: TestUser; inviteId: string }> {
  const owner = await createUser()
  const team = await createTeam(owner, 'Drama 101')
  const person = invitee ?? (await createUser())
  expect((await invite(owner, team.id, person.email)).status).toBe(204)
  const rows = await invitesOf(person)
  return { owner, teamId: team.id, invitee: person, inviteId: rows[rows.length - 1].id }
}

async function memberCount(teamId: string, user: TestUser): Promise<number> {
  return (await teamRows('team_members', teamId)).filter((row) => row.user === user.id).length
}

// Review Focus 5: only the invited person answers. Anyone else, the owner and a team
// member included, gets the same 404 as for an invite id that does not exist (so invite
// ids do not leak), and the invite stays pending with nobody added.
test('answer: another user cannot accept or decline someone else\'s invite (404)', async () => {
  const { owner, teamId, invitee, inviteId } = await pendingInvite()
  const [member, stranger] = [await createUser(), await createUser()]
  await addMember(teamId, member)

  const replies = []
  for (const user of [owner, member, stranger]) {
    replies.push(await accept(user, inviteId), await decline(user, inviteId))
  }
  replies.push(await accept(stranger, 'nonexistent0000'))

  for (const reply of replies) {
    expect(reply.status).toBe(404)
    expect(reply.body).toEqual(replies[0].body)
  }
  expect(replies[0].body?.message).toBe(NO_INVITE)
  expect((await onlyInviteOf(invitee)).status).toBe('pending')
  expect(await memberCount(teamId, stranger)).toBe(0)
  expect(await memberCount(teamId, invitee)).toBe(0)
})

// An invite is answered once: a second accept is 409 and leaves one member row; a
// decline after an accept is 409 and the person stays a member.
test('answer: an invite cannot be accepted twice or declined after it was accepted', async () => {
  const { teamId, invitee, inviteId } = await pendingInvite()

  expect((await accept(invitee, inviteId)).status).toBe(200)
  const again = await accept(invitee, inviteId)
  const declined = await decline(invitee, inviteId)

  for (const reply of [again, declined]) {
    expect(reply.status).toBe(409)
    expect(reply.body?.message).toBe(ANSWERED)
  }
  expect(await memberCount(teamId, invitee)).toBe(1)
  expect((await onlyInviteOf(invitee)).status).toBe('accepted')
})

// Double clicks and two tabs: accepts sent at once make exactly one member row; one
// succeeds and the rest are told it was already answered.
test('answer: simultaneous accepts give exactly one member row', async () => {
  const { teamId, invitee, inviteId } = await pendingInvite()
  const token = await tokenOf(invitee)

  const replies = await Promise.all(Array.from({ length: 5 }, () => send(token, `/api/kwnto/invites/${inviteId}/accept`, { method: 'POST' })))

  expect(replies.map((reply) => reply.status).sort()).toEqual([200, 409, 409, 409, 409])
  expect(await memberCount(teamId, invitee)).toBe(1)
})

// Design 5 (the invitee must accept): declining marks the invite declined and adds
// nobody; the declined invite cannot be accepted later; the owner may invite the person
// again, and the new invite works.
test('answer: declining sets declined and adds nobody; a declined person can be invited again', async () => {
  const { owner, teamId, invitee, inviteId } = await pendingInvite()

  const declined = await decline(invitee, inviteId)

  expect(declined.status).toBe(204)
  expect((await onlyInviteOf(invitee)).status).toBe('declined')
  expect(await memberCount(teamId, invitee)).toBe(0)
  expect((await accept(invitee, inviteId)).status).toBe(409)
  expect(await memberCount(teamId, invitee)).toBe(0)

  expect((await invite(owner, teamId, invitee.email)).status).toBe(204)
  const rows = await invitesOf(invitee)
  expect(rows.map((row) => row.status)).toEqual(['declined', 'pending'])
  expect((await accept(invitee, rows[1].id)).status).toBe(200)
  expect(await memberCount(teamId, invitee)).toBe(1)
})

// Someone invited who joins by code before answering is already a member: accepting is
// still fine (200) and adds no second row.
test('answer: accepting when already a member (joined by code meanwhile) gives 200 and one row', async () => {
  const { teamId, invitee, inviteId } = await pendingInvite()
  await addMember(teamId, invitee)

  expect((await accept(invitee, inviteId)).status).toBe(200)
  expect(await memberCount(teamId, invitee)).toBe(1)
  expect((await onlyInviteOf(invitee)).status).toBe('accepted')
})

// Verified email is required to join teams (design 7c, security.md section 3): an
// unverified invitee can see the invite but cannot accept (or decline) it; it stays
// pending and works once they have verified.
test('answer: an unverified invitee cannot accept (403) and stays invited', async () => {
  const invitee = await unverifiedUser()
  const { teamId, inviteId } = await pendingInvite(invitee)

  const accepted = await accept(invitee, inviteId)
  const declined = await decline(invitee, inviteId)

  expect(accepted.status).toBe(403)
  expect(declined.status).toBe(403)
  expect((await (await asUser(invitee)).collection('team_invites').getFullList()).map((row) => row.id)).toEqual([inviteId])
  expect((await onlyInviteOf(invitee)).status).toBe('pending')
  expect(await memberCount(teamId, invitee)).toBe(0)

  await setVerified(invitee, true)
  expect((await accept(invitee, inviteId)).status).toBe(200)
  expect((await memberRow(teamId, invitee.id)).role).toBe('member')
})

// Security.md section 3 (rate limit, D3): with team_attempts_per_hour 3, the owner's
// fourth invite attempt in the hour is refused with 429, for an existing email or an
// unknown one, and nobody is invited. A refused attempt is not counted (Task 7 ruling),
// so raising the setting to 4 lets exactly one more attempt through.
test('rate limit: the fourth invite attempt in an hour is 429, existing email or unknown', async () => {
  const owner = await createUser()
  const team = await createTeam(owner)
  const [first, second] = [await createUser(), await createUser()]
  await setAttemptsPerHour(3)

  const statuses = [
    (await invite(owner, team.id, first.email)).status,
    (await invite(owner, team.id, 'nobody-1@example.test')).status,
    (await invite(owner, team.id, 'nobody-2@example.test')).status,
  ]
  const fourth = await invite(owner, team.id, second.email)
  const fifth = await invite(owner, team.id, 'nobody-3@example.test')

  expect(statuses).toEqual([204, 404, 404])
  for (const reply of [fourth, fifth]) {
    expect(reply.status).toBe(429)
    expect(reply.body?.message).toBe(TOO_MANY)
  }
  expect(await invitesOf(second)).toHaveLength(0)

  await setAttemptsPerHour(4)
  expect((await invite(owner, team.id, second.email)).status).toBe(204)
  expect((await invite(owner, team.id, 'nobody-4@example.test')).status).toBe(429)
})

// D3: join-code and invite attempts share one limit per user, in both directions, so
// nobody gets twice the guesses by mixing them.
test('rate limit: join attempts count toward the invite limit and invite attempts toward the join limit', async () => {
  const [joiner, inviter, invitee] = [await createUser(), await createUser(), await createUser()]
  const joinerTeam = await createTeam(joiner)
  const inviterTeam = await createTeam(inviter)
  const openTeam = await createTeam(await createUser())
  const settings = (await teamRows('team_settings', openTeam.id))[0] as { id: string }
  await (await asAdmin()).collection('team_settings').update(settings.id, { join_code_enabled: true })
  await setAttemptsPerHour(3)

  for (const code of ['WRONG234', 'WRONG235', 'WRONG236']) {
    expect((await joinByCode(joiner, code)).status).toBe(404)
  }
  expect((await invite(joiner, joinerTeam.id, invitee.email)).status).toBe(429)

  for (const email of ['nobody-1@example.test', 'nobody-2@example.test', 'nobody-3@example.test']) {
    expect((await invite(inviter, inviterTeam.id, email)).status).toBe(404)
  }
  expect((await joinByCode(inviter, openTeam.joinCode)).status).toBe(429)
  expect(await invitesOf(invitee)).toHaveLength(0)
})

// Design 6.9 and security.md section 8: every invite attempt by a verified caller is an
// `invite` event with its outcome and the email's domain, never the address (the log
// must not become a list of registered emails). Answering an invite is not an attempt.
test('log: each invite attempt writes one event with its outcome and domain, never the email', async () => {
  const owner = await createUser()
  const team = await createTeam(owner)
  const [member, outsider, invitee] = [await createUser(), await createUser(), await createUser()]
  await addMember(team.id, member)
  const unknown = `nobody-${invitee.id}@unknown.test`

  await invite(owner, team.id, invitee.email) // 204
  await invite(owner, team.id, unknown) // 404
  await invite(owner, team.id, invitee.email.toUpperCase()) // 409
  await invite(owner, team.id, 'no-at-sign') // 404
  await invite(member, team.id, invitee.email) // 403
  await invite(outsider, team.id, invitee.email) // 404
  await setAttemptsPerHour(5)
  await invite(owner, team.id, unknown) // 404, the owner's fifth attempt
  await invite(owner, team.id, unknown) // 429
  await accept(invitee, (await onlyInviteOf(invitee)).id)

  const domain = 'example.test'
  expect((await eventsOf(owner, 'invite')).map((event) => event.detail)).toEqual([
    { ok: true, emailDomain: domain, team: team.id },
    { ok: false, emailDomain: 'unknown.test', team: team.id },
    { ok: false, emailDomain: domain, team: team.id },
    { ok: false, emailDomain: '', team: team.id },
    { ok: false, emailDomain: 'unknown.test', team: team.id },
    { ok: false, limited: true, emailDomain: 'unknown.test', team: team.id },
  ])
  expect((await eventsOf(member, 'invite')).map((event) => event.detail)).toEqual([{ ok: false, emailDomain: domain, team: team.id }])
  expect((await eventsOf(outsider, 'invite')).map((event) => event.detail)).toEqual([{ ok: false, emailDomain: domain, team: team.id }])
  expect(await eventsOf(invitee, 'invite')).toHaveLength(0)

  // Every invite event of the run, from every test: `sign-in` events do hold the email
  // as typed (Task 4, lockout), so the check is on invite events.
  const allInvites = await (await asAdmin()).collection('security_events').getFullList({ filter: "type = 'invite'" })
  const everything = JSON.stringify(allInvites)
  for (const email of [invitee.email, invitee.email.toUpperCase(), unknown, 'no-at-sign']) {
    expect(everything).not.toContain(email)
  }
})
