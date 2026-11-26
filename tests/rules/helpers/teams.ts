import { expect } from 'vitest'
import { asAdmin, type TestUser } from './pb.ts'

// Team helpers for the team rule tests. Joining (Task 7) and invites (Task 8) do not
// exist yet, so a plain member is added by the admin, who bypasses the create rule.

export async function addMember(teamId: string, user: TestUser): Promise<string> {
  const row = await (await asAdmin()).collection('team_members').create({ team: teamId, user: user.id, role: 'member' })
  return row.id
}

// The rows of one team in a team table, read as the admin (who bypasses every rule).
export async function teamRows(collection: string, teamId: string): Promise<Record<string, unknown>[]> {
  const admin = await asAdmin()
  return admin.collection(collection).getFullList({ filter: admin.filter('team = {:team}', { team: teamId }) })
}

// The membership row of one user in one team, read as the admin.
export async function memberRow(teamId: string, userId: string): Promise<Record<string, unknown> & { id: string }> {
  const admin = await asAdmin()
  const filter = admin.filter('team = {:team} && user = {:user}', { team: teamId, user: userId })
  return admin.collection('team_members').getFirstListItem(filter)
}

// A refused create: PocketBase answers a failed create rule with 400 ("Failed to
// create record") and a locked (null) one with 403.
export async function expectCreateRefused(request: Promise<unknown>): Promise<void> {
  const error: unknown = await request.then(
    () => null,
    (e: unknown) => e,
  )
  expect(error, 'the create was allowed').not.toBeNull()
  expect([400, 403]).toContain((error as { status?: number }).status)
}

// Emails are private to everyone but the admin (design 5); no team response may hold
// one. Every test email is user-<uuid>@example.test, so an "@" anywhere is a leak.
export function expectNoEmail(response: unknown): void {
  expect(JSON.stringify(response)).not.toContain('@')
}

// For responses that expand user records: the caller may see their OWN record (users
// rule: own record only), so this checks that none of the given other people's emails
// is present.
export function expectNoEmailOf(response: unknown, ...others: TestUser[]): void {
  const text = JSON.stringify(response)
  for (const user of others) {
    expect(text).not.toContain(user.email)
  }
}
