import crypto from 'node:crypto'
import { asAdmin, asUser, createUser, rawSend, signUp, type SendInit, type TestUser } from './pb.ts'

// Helpers for the invite and join route tests (teams.invites.rules.test.ts).

export const TOO_MANY = 'Too many attempts. Try again later.'

// One answer of a custom route: the status, the parsed body (null for an empty 204) and
// the raw text of the body and headers, so a test can search them for an email.
export type Reply = { status: number; body: Record<string, unknown> | null; raw: string }

export function invitePath(teamId: string): string {
  return `/api/kwnto/teams/${teamId}/invites`
}

export async function tokenOf(user: TestUser): Promise<string> {
  return (await asUser(user)).authStore.token
}

export async function send(token: string | undefined, path: string, init: SendInit): Promise<Reply> {
  const response = await rawSend(token, path, init)
  const text = await response.text()
  const headers = [...response.headers].map(([name, value]) => `${name}: ${value}`).join('\n')
  const body = text === '' ? null : (JSON.parse(text) as Record<string, unknown>)
  return { status: response.status, body, raw: `${headers}\n\n${text}` }
}

export async function invite(owner: TestUser, teamId: string, email: unknown): Promise<Reply> {
  return send(await tokenOf(owner), invitePath(teamId), { method: 'POST', body: { email } })
}

export async function accept(user: TestUser, inviteId: string): Promise<Reply> {
  return send(await tokenOf(user), `/api/kwnto/invites/${inviteId}/accept`, { method: 'POST' })
}

export async function decline(user: TestUser, inviteId: string): Promise<Reply> {
  return send(await tokenOf(user), `/api/kwnto/invites/${inviteId}/decline`, { method: 'POST' })
}

export async function joinByCode(user: TestUser, code: string): Promise<Reply> {
  return send(await tokenOf(user), '/api/kwnto/teams/join', { method: 'POST', body: { code } })
}

// Every invite a person has received, oldest first, read as the admin.
export async function invitesOf(user: TestUser): Promise<(Record<string, unknown> & { id: string })[]> {
  const admin = await asAdmin()
  const filter = admin.filter('invited_user = {:user}', { user: user.id })
  return admin.collection('team_invites').getFullList({ filter, sort: 'created' })
}

// The only invite a person has received (fails the test if there is not exactly one).
export async function onlyInviteOf(user: TestUser): Promise<Record<string, unknown> & { id: string }> {
  const rows = await invitesOf(user)
  if (rows.length !== 1) throw new Error(`expected one invite, found ${rows.length}`)
  return rows[0]
}

export async function eventsOf(user: TestUser, type: 'invite' | 'join'): Promise<Record<string, unknown>[]> {
  const admin = await asAdmin()
  const filter = admin.filter('type = {:type} && user = {:user}', { type, user: user.id })
  return admin.collection('security_events').getFullList({ filter, sort: 'created' })
}

export async function setAttemptsPerHour(value: number): Promise<void> {
  const admin = await asAdmin()
  const record = await admin.collection('system_behavior').getFirstListItem('')
  await admin.collection('system_behavior').update(record.id, { team_attempts_per_hour: value })
}

export async function setName(user: TestUser, name: string): Promise<void> {
  await (await asAdmin()).collection('users').update(user.id, { name })
}

// A verified account with a name, as most invite tests need.
export async function namedUser(name: string): Promise<TestUser> {
  const user = await createUser()
  await setName(user, name)
  return user
}

// An account made through the public sign-up, so it is not verified.
export async function unverifiedUser(): Promise<TestUser> {
  const email = `user-${crypto.randomUUID()}@example.test`
  const password = 'Test-password-1234'
  return { ...(await signUp(email, password)), email, password }
}

export async function setVerified(user: TestUser, verified: boolean): Promise<void> {
  await (await asAdmin()).collection('users').update(user.id, { verified })
}
