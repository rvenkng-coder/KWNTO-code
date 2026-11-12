import crypto from 'node:crypto'
import { afterEach, expect, test } from 'vitest'
import { asAdmin, asUser, createTeam, createUser, rawSend, signUp, type SendInit, type TestUser } from './helpers/pb.ts'
import { addMember, expectNoEmail, memberRow, teamRows } from './helpers/teams.ts'

// Joining a team by code and the owner's code control (design 5; docs/security.md
// section 2 "only the owner regenerates or disables the join code" and section 3, the
// guess limit), built by backend/pb_hooks/teams-join.pb.js. Not a collection, so no
// coverage entry: an extra rules file next to teams.rules.test.ts.
//
// The rate-limit tests change `team_attempts_per_hour` and restore it in afterEach; safe
// only because rule files run one at a time (vitest.config.ts). Every other test uses
// fresh users, so the default limit of 20 per user is never reached.

const JOIN = '/api/kwnto/teams/join'
const NOT_VALID = 'That join code is not valid.'
const TOO_MANY = 'Too many attempts. Try again later.'

type Reply = { status: number; body: Record<string, unknown> }

function regeneratePath(teamId: string): string {
  return `/api/kwnto/teams/${teamId}/regenerate-code`
}

async function tokenOf(user: TestUser): Promise<string> {
  return (await asUser(user)).authStore.token
}

async function send(token: string | undefined, path: string, init: SendInit): Promise<Reply> {
  const response = await rawSend(token, path, init)
  return { status: response.status, body: (await response.json()) as Record<string, unknown> }
}

async function join(user: TestUser, code: unknown): Promise<Reply> {
  return send(await tokenOf(user), JOIN, { method: 'POST', body: { code } })
}

async function regenerate(user: TestUser, teamId: string): Promise<Reply> {
  return send(await tokenOf(user), regeneratePath(teamId), { method: 'POST' })
}

async function settingsOf(teamId: string): Promise<Record<string, unknown> & { id: string }> {
  const rows = await teamRows('team_settings', teamId)
  expect(rows).toHaveLength(1)
  return rows[0] as Record<string, unknown> & { id: string }
}

// The owner turns the code on through their own session (decision D1: off by default).
async function teamWithOpenCode(owner: TestUser, name?: string): Promise<{ id: string; joinCode: string }> {
  const team = await createTeam(owner, name)
  const row = await settingsOf(team.id)
  await (await asUser(owner)).collection('team_settings').update(row.id, { join_code_enabled: true })
  return team
}

async function membershipsOf(user: TestUser): Promise<Record<string, unknown>[]> {
  const admin = await asAdmin()
  return admin.collection('team_members').getFullList({ filter: admin.filter('user = {:user}', { user: user.id }) })
}

async function joinEventsOf(user: TestUser): Promise<Record<string, unknown>[]> {
  const admin = await asAdmin()
  const filter = admin.filter("type = 'join' && user = {:user}", { user: user.id })
  return admin.collection('security_events').getFullList({ filter, sort: 'created' })
}

async function setAttemptsPerHour(value: number): Promise<void> {
  const admin = await asAdmin()
  const record = await admin.collection('system_behavior').getFirstListItem('')
  await admin.collection('system_behavior').update(record.id, { team_attempts_per_hour: value })
}

afterEach(async () => {
  await setAttemptsPerHour(20)
})

// Design 5 (join by code): a verified user with the code becomes a plain member, with
// the name copy teammates read (D6), and learns the team's id and name and nothing else
// (no other member, no code, no email: Review Focus 5).
test('join: a verified user with an enabled code becomes a member and learns only the team id and name', async () => {
  const [owner, joiner] = [await createUser(), await createUser()]
  await (await asAdmin()).collection('users').update(joiner.id, { name: 'Jo Joiner' })
  const team = await teamWithOpenCode(owner, 'Drama 101')

  const reply = await join(joiner, team.joinCode)

  expect(reply.status).toBe(200)
  expect(reply.body).toEqual({ team: team.id, name: 'Drama 101' })
  expectNoEmail(reply.body)
  const row = await memberRow(team.id, joiner.id)
  expect(row.role).toBe('member')
  expect(row.user_name).toBe('Jo Joiner')
})

// Design 5: the code is read off a projector and typed by hand, so case and stray
// spaces must not matter.
test('join: the code works in lower case and with surrounding spaces', async () => {
  const [owner, joiner] = [await createUser(), await createUser()]
  const team = await teamWithOpenCode(owner)

  const reply = await join(joiner, `  ${team.joinCode.toLowerCase()}  `)

  expect(reply.status).toBe(200)
  expect((await memberRow(team.id, joiner.id)).role).toBe('member')
})

// A second tap on "Join" must not fail or make a second membership row.
test('join: joining again is 200 and makes no duplicate member row', async () => {
  const [owner, joiner] = [await createUser(), await createUser()]
  const team = await teamWithOpenCode(owner)

  expect((await join(joiner, team.joinCode)).status).toBe(200)
  const again = await join(joiner, team.joinCode)

  expect(again.status).toBe(200)
  expect(again.body).toEqual({ team: team.id, name: 'Test team' })
  expect(await teamRows('team_members', team.id)).toHaveLength(2)
})

// Two joins sent at once by one user (double click, two tabs) give exactly one row: the
// unique index on (team, user) plus the route's transaction must not turn into an error.
test('join: simultaneous joins by the same user give exactly one member row', async () => {
  const [owner, joiner] = [await createUser(), await createUser()]
  const team = await teamWithOpenCode(owner)
  const token = await tokenOf(joiner)

  const replies = await Promise.all(Array.from({ length: 5 }, () => send(token, JOIN, { method: 'POST', body: { code: team.joinCode } })))

  expect(replies.map((reply) => reply.status)).toEqual([200, 200, 200, 200, 200])
  expect(await membershipsOf(joiner)).toHaveLength(1)
})

// No oracle (design 5, security.md section 3): a disabled code, a wrong code, a missing
// code and filter-injection strings all give the same 404 and message, so a guesser
// cannot tell a real but disabled code from nonsense; and none of them joins anything.
// The injection cases also pin that the lookup binds the code as a parameter.
test('join: disabled, wrong, missing and injected codes all give the same 404 and join nothing', async () => {
  const [owner, joiner] = [await createUser(), await createUser()]
  const disabled = await createTeam(owner)
  await teamWithOpenCode(owner) // an enabled code exists, so an injection that matched "any row" would join it

  const replies = [
    await join(joiner, disabled.joinCode),
    await join(joiner, 'WRONG234'),
    await send(await tokenOf(joiner), JOIN, { method: 'POST' }),
    await join(joiner, ''),
    await join(joiner, 12345678),
    await join(joiner, "' OR 1=1 --"),
    await join(joiner, '%'),
  ]

  for (const reply of replies) {
    expect(reply.status).toBe(404)
    expect(reply.body).toEqual(replies[0].body)
  }
  expect(replies[0].body.message).toBe(NOT_VALID)
  expect(await membershipsOf(joiner)).toHaveLength(0)
})

// Verified email is required to join teams (design 7c sign-up, security.md section 3),
// and both routes need a signed-in caller.
test('join and regenerate: unverified gets 403 and signed-out gets 401, and nothing changes', async () => {
  const owner = await createUser()
  const team = await teamWithOpenCode(owner)
  const email = `user-${crypto.randomUUID()}@example.test`
  const password = 'Test-password-1234'
  const unverified: TestUser = { ...(await signUp(email, password)), email, password }

  expect((await join(unverified, team.joinCode)).status).toBe(403)
  expect((await regenerate(unverified, team.id)).status).toBe(403)
  expect((await send(undefined, JOIN, { method: 'POST', body: { code: team.joinCode } })).status).toBe(401)
  expect((await send(undefined, regeneratePath(team.id), { method: 'POST' })).status).toBe(401)

  expect(await membershipsOf(unverified)).toHaveLength(0)
  expect((await settingsOf(team.id)).join_code).toBe(team.joinCode)
})

// Design 5: the owner regenerates the code (for example after it leaked); the old code
// stops working at once, the new one works, and the owner reads the same new code in
// team_settings.
test('regenerate: the owner gets a new code; the old one stops working and the new one works', async () => {
  const [owner, before, after] = [await createUser(), await createUser(), await createUser()]
  const team = await teamWithOpenCode(owner)

  const reply = await regenerate(owner, team.id)

  expect(reply.status).toBe(200)
  expect(Object.keys(reply.body)).toEqual(['join_code'])
  const code = String(reply.body.join_code)
  expect(code).toMatch(/^[ABCDEFGHJKLMNPQRSTUVWXYZ23456789]{8}$/)
  expect(code).not.toBe(team.joinCode)
  const row = await settingsOf(team.id)
  expect((await (await asUser(owner)).collection('team_settings').getOne(row.id)).join_code).toBe(code)
  expect((await join(before, team.joinCode)).status).toBe(404)
  expect((await join(after, code)).status).toBe(200)
})

// Security.md section 2: only the owner controls the code. A plain member is told no
// (403); someone outside the team, including the owner of ANOTHER team and a caller
// with an id that does not exist, gets the same 404, so the route does not reveal which
// team ids exist. Nothing is written to the team's settings.
test('regenerate: a member gets 403; an outsider, another team\'s owner and an unknown id get the same 404', async () => {
  const [owner, member, outsider, otherOwner] = [await createUser(), await createUser(), await createUser(), await createUser()]
  const team = await teamWithOpenCode(owner)
  await createTeam(otherOwner) // otherOwner owns team B
  await addMember(team.id, member)
  const settingsBefore = await settingsOf(team.id)

  const asMember = await regenerate(member, team.id)
  const asOutsider = await regenerate(outsider, team.id)
  const asOtherOwner = await regenerate(otherOwner, team.id)
  const unknownId = await regenerate(outsider, 'nonexistent0000')

  expect(asMember.status).toBe(403)
  for (const reply of [asOutsider, asOtherOwner, unknownId]) {
    expect(reply.status).toBe(404)
    expect(reply.body).toEqual(asOutsider.body)
  }
  expect(await settingsOf(team.id)).toEqual(settingsBefore)
})

// Security.md section 3 (rate limit, D3): with team_attempts_per_hour 3, a user's fourth
// attempt in the hour is refused with 429 even with the right code, and other users are
// not affected. A refused attempt is not counted (it is logged with `limited`), so the
// limit ends an hour after the attempts that caused it: raising the setting to 4 lets
// exactly one more attempt through.
test('rate limit: the fourth attempt in an hour is 429, right code or wrong, and only for that user', async () => {
  const [owner, guesser, other] = [await createUser(), await createUser(), await createUser()]
  const team = await teamWithOpenCode(owner)
  await setAttemptsPerHour(3)

  const statuses = [
    (await join(guesser, 'WRONG234')).status,
    (await join(guesser, 'WRONG235')).status,
    (await join(guesser, 'WRONG236')).status,
  ]
  const fourth = await join(guesser, team.joinCode)
  const fifth = await join(guesser, team.joinCode)

  expect(statuses).toEqual([404, 404, 404])
  expect(fourth.status).toBe(429)
  expect(fourth.body.message).toBe(TOO_MANY)
  expect(fifth.status).toBe(429)
  expect(await membershipsOf(guesser)).toHaveLength(0)
  expect((await join(other, team.joinCode)).status).toBe(200)

  await setAttemptsPerHour(4)
  expect((await join(guesser, team.joinCode)).status).toBe(200)
})

// D3: join-code and invite attempts share one limit per user, so an owner cannot get
// twice the guesses by mixing them.
test('rate limit: invite attempts count toward the same limit', async () => {
  const [owner, user] = [await createUser(), await createUser()]
  const team = await teamWithOpenCode(owner)
  await setAttemptsPerHour(3)
  await (await asAdmin()).collection('security_events').create({ type: 'invite', user: user.id, ip: '', detail: { ok: true } })

  expect((await join(user, 'WRONG234')).status).toBe(404)
  expect((await join(user, 'WRONG235')).status).toBe(404)
  expect((await join(user, team.joinCode)).status).toBe(429)
})

// Design 6.9 and security.md section 8: every attempt is in the security log with its
// outcome, but never the code itself, which would let anyone reading the log join.
test('log: each attempt writes one join event with its outcome and never the code', async () => {
  const [owner, user] = [await createUser(), await createUser()]
  const team = await teamWithOpenCode(owner)

  await join(user, 'WRONG234')
  await join(user, team.joinCode.toLowerCase())
  await setAttemptsPerHour(2)
  await join(user, team.joinCode)

  const events = await joinEventsOf(user)
  expect(events.map((event) => event.detail)).toEqual([
    { ok: false },
    { ok: true, team: team.id },
    { ok: false, limited: true },
  ])
  const allDetails = JSON.stringify((await (await asAdmin()).collection('security_events').getFullList()).map((event) => event.detail))
  for (const code of [team.joinCode, team.joinCode.toLowerCase(), 'WRONG234']) {
    expect(allDetails).not.toContain(code)
  }
})
