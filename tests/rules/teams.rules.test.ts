import { expect, test } from 'vitest'
import { expectNoRows, expectRefused } from './helpers/admin-only.ts'
import { asAdmin, asAnonymous, asUser, createTeam, createUser } from './helpers/pb.ts'
import { addMember, expectCreateRefused, expectNoEmail, teamRows } from './helpers/teams.ts'

// Protects design section 5 (teams): "The team creator is its owner", "A user can belong
// to several teams", "Only the owner ... deletes the team", and the router's "Verified
// email is required to create or join teams". Also docs/security.md section 2 (deny by
// default: someone outside a team sees nothing of it).

async function teamsOwnedBy(userId: string): Promise<Record<string, unknown>[]> {
  const admin = await asAdmin()
  return admin.collection('teams').getFullList({ filter: admin.filter('owner = {:id}', { id: userId }) })
}

// Design 5: "The team creator is its owner"; the owner row and the settings row are made
// with the team (ERD: rows that should exist are created with the parent), and the join
// code is off by default (decision D1).
test('teams: a verified user creates a team and becomes its owner, with a settings row', async () => {
  const owner = await createUser()
  const created = await (await asUser(owner)).collection('teams').create({ name: 'Capstone', owner: owner.id })
  expect(created).toMatchObject({ name: 'Capstone', owner: owner.id })

  const members = await teamRows('team_members', created.id)
  expect(members).toHaveLength(1)
  expect(members[0]).toMatchObject({ user: owner.id, role: 'owner' })

  const settings = await teamRows('team_settings', created.id)
  expect(settings).toHaveLength(1)
  expect(String(settings[0]?.join_code)).toMatch(/^[ABCDEFGHJKLMNPQRSTUVWXYZ23456789]{8}$/)
  expect(settings[0]?.join_code_enabled).toBe(false)
})

// Router: "Verified email is required to create or join teams" (the Task 3 rule fragment
// @request.auth.verified = true). PocketBase answers a failed create rule with 400.
test('teams: an unverified user cannot create a team', async () => {
  const unverified = await createUser({ verified: false })
  const pb = await asUser(unverified)
  const error: unknown = await pb.collection('teams').create({ name: 'Nope', owner: unverified.id }).then(() => null, (e: unknown) => e)
  expect((error as { status?: number } | null)?.status).toBe(400)
  expect(await teamsOwnedBy(unverified.id)).toHaveLength(0)
})

// Design 5: the creator is the owner. Naming someone else as owner would hand them a
// team they never made (and make their account undeletable, see team_members tests).
test('teams: a user cannot create a team owned by someone else', async () => {
  const [caller, victim] = [await createUser(), await createUser()]
  await expectCreateRefused((await asUser(caller)).collection('teams').create({ name: 'Gift', owner: victim.id }))
  expect(await teamsOwnedBy(victim.id)).toHaveLength(0)
})

// ERD: a team name is 1 to 80 characters.
test('teams: an empty name or one longer than 80 characters is refused', async () => {
  const owner = await createUser()
  const pb = await asUser(owner)
  await expect(pb.collection('teams').create({ name: '', owner: owner.id })).rejects.toMatchObject({ status: 400 })
  await expect(pb.collection('teams').create({ name: 'x'.repeat(81), owner: owner.id })).rejects.toMatchObject({ status: 400 })
  expect(await teamsOwnedBy(owner.id)).toHaveLength(0)
})

// Design 5: members can see their team; "Only the owner ... deletes the team".
test('teams: a member who is not the owner can list and view the team but not rename or delete it', async () => {
  const [owner, member] = [await createUser(), await createUser()]
  const team = await createTeam(owner, 'Original')
  await addMember(team.id, member)
  const pb = await asUser(member)

  expect((await pb.collection('teams').getFullList()).map((t) => t.id)).toEqual([team.id])
  expect((await pb.collection('teams').getOne(team.id)).name).toBe('Original')
  await expectRefused(pb.collection('teams').update(team.id, { name: 'Taken over' }))
  await expectRefused(pb.collection('teams').delete(team.id))
  expect((await (await asAdmin()).collection('teams').getOne(team.id)).name).toBe('Original')
})

// Design 5: the owner runs the team; deleting it removes its members and its settings
// (cascade), so no orphaned membership or join code survives.
test('teams: the owner can rename and delete the team, and deleting removes members and settings', async () => {
  const [owner, member] = [await createUser(), await createUser()]
  const team = await createTeam(owner, 'Before')
  await addMember(team.id, member)
  const pb = await asUser(owner)

  expect((await pb.collection('teams').update(team.id, { name: 'After' })).name).toBe('After')
  await pb.collection('teams').delete(team.id)

  expect(await teamsOwnedBy(owner.id)).toHaveLength(0)
  expect(await teamRows('team_members', team.id)).toHaveLength(0)
  expect(await teamRows('team_settings', team.id)).toHaveLength(0)
})

// Ownership is fixed at creation. Handing the team to another account would give an
// outsider the owner's powers and leave the role in team_members out of step.
test('teams: the owner cannot hand the team to another account', async () => {
  const [owner, other] = [await createUser(), await createUser()]
  const team = await createTeam(owner)
  await expectRefused((await asUser(owner)).collection('teams').update(team.id, { owner: other.id }))
  expect((await (await asAdmin()).collection('teams').getOne(team.id)).owner).toBe(owner.id)
})

// docs/security.md section 2: someone outside the team, signed in or not, sees nothing.
test('teams: an outsider and a signed-out visitor see nothing', async () => {
  const [owner, outsider] = [await createUser(), await createUser()]
  const team = await createTeam(owner)

  for (const pb of [await asUser(outsider), asAnonymous()]) {
    await expectNoRows(pb, 'teams')
    await expect(pb.collection('teams').getOne(team.id)).rejects.toMatchObject({ status: 404 })
    await expectRefused(pb.collection('teams').update(team.id, { name: 'Mine now' }))
    await expectRefused(pb.collection('teams').delete(team.id))
  }
  await expectCreateRefused(asAnonymous().collection('teams').create({ name: 'Anon', owner: owner.id }))
})

// Design 5: "A user can belong to several teams".
test('teams: a user in two teams lists both', async () => {
  const [someone, otherOwner] = [await createUser(), await createUser()]
  const own = await createTeam(someone, 'Own team')
  const joined = await createTeam(otherOwner, 'Joined team')
  await addMember(joined.id, someone)

  const listed = await (await asUser(someone)).collection('teams').getFullList()
  expect(listed.map((t) => t.id).sort()).toEqual([own.id, joined.id].sort())
})

// Design 5: emails are private. Expanding the owner must not reveal their record to a member.
test("teams: a member's team list holds no email, even when expanding the owner", async () => {
  const [owner, member] = [await createUser(), await createUser()]
  const team = await createTeam(owner)
  await addMember(team.id, member)

  const pb = await asUser(member)
  expectNoEmail(await pb.collection('teams').getFullList({ expand: 'owner' }))
  expectNoEmail(await pb.collection('teams').getOne(team.id, { expand: 'owner' }))
})

// Injection strings must be treated as data (docs/security.md section 5).
test('teams: an injection string in a filter returns nothing', async () => {
  const someone = await createUser()
  await createTeam(someone)
  const pb = await asUser(someone)
  await expectNoRows(pb, 'teams', pb.filter('id = {:n}', { n: `' OR 1=1 --` }))
})
