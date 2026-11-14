import { expect, test } from 'vitest'
import { expectNoRows, expectRefused } from './helpers/admin-only.ts'
import { asAdmin, asAnonymous, asUser, createTeam, createUser, type TestUser } from './helpers/pb.ts'
import { addMember, expectCreateRefused, expectNoEmail, expectNoEmailOf, memberRow, teamRows } from './helpers/teams.ts'

// Protects design section 5 (teams and roles): members see their team, "Only the owner
// removes members", emails are private to everyone except the admin (teammates see
// names, decision D6), and a member cannot leave or be made owner (decision D8).
// Plan Review Focus 5: a user must not add themselves to a team by writing team_members.
// Also docs/security.md section 2 (deny by default).

async function setName(user: TestUser, name: string): Promise<void> {
  await (await asUser(user)).collection('users').update(user.id, { name })
}

// Design 5 and D6: a teammate sees the others by name, never by email.
test('team_members: a member lists the members of their team by name, with no email in the response', async () => {
  const [owner, member] = [await createUser(), await createUser()]
  await setName(owner, 'Olive Owner')
  await setName(member, 'Max Member')
  const team = await createTeam(owner)
  await addMember(team.id, member)

  const pb = await asUser(member)
  const rows = await pb.collection('team_members').getFullList()
  expect(rows.map((r) => [r.user_name, r.role]).sort()).toEqual([['Max Member', 'member'], ['Olive Owner', 'owner']])
  expectNoEmail(rows)
  const ownerRow = await memberRow(team.id, owner.id)
  expectNoEmail(await pb.collection('team_members').getOne(ownerRow.id))

  // Expanding cannot reach a teammate's user record either. (The caller's own record
  // may expand: the users rule shows each person their own record, email included.)
  const expanded = await pb.collection('team_members').getFullList({ expand: 'user,team,team.owner' })
  expectNoEmailOf(expanded, owner)
  expectNoEmail(await pb.collection('team_members').getOne(ownerRow.id, { expand: 'user,team.owner' }))
})

// docs/security.md section 2: someone outside the team, signed in or not, sees no member.
test('team_members: an outsider and a signed-out visitor see none of the members', async () => {
  const [owner, outsider] = [await createUser(), await createUser()]
  const team = await createTeam(owner)
  const ownerRow = await memberRow(team.id, owner.id)

  for (const pb of [await asUser(outsider), asAnonymous()]) {
    await expectNoRows(pb, 'team_members')
    await expect(pb.collection('team_members').getOne(ownerRow.id)).rejects.toMatchObject({ status: 404 })
    await expectRefused(pb.collection('team_members').delete(ownerRow.id))
  }
})

// Review Focus 5: joining goes through the join code or an invite (Tasks 7 and 8),
// never by writing a membership row directly.
test("team_members: a user cannot add themselves to someone else's team", async () => {
  const [owner, intruder] = [await createUser(), await createUser()]
  const team = await createTeam(owner)
  const pb = await asUser(intruder)

  await expectCreateRefused(pb.collection('team_members').create({ team: team.id, user: intruder.id, role: 'member' }))
  await expectCreateRefused(pb.collection('team_members').create({ team: team.id, user: intruder.id, role: 'owner' }))
  expect((await teamRows('team_members', team.id)).map((r) => r.user)).toEqual([owner.id])
  await expectNoRows(pb, 'teams')
})

// Review Focus 5 and D8: roles are fixed; a member cannot promote themselves, and no
// one (the owner included) edits a membership row through the API.
test('team_members: nobody can update a membership row, so a member cannot make themselves owner', async () => {
  const [owner, member] = [await createUser(), await createUser()]
  const team = await createTeam(owner)
  const memberRowId = await addMember(team.id, member)
  const ownerRowId = (await memberRow(team.id, owner.id)).id

  await expectRefused((await asUser(member)).collection('team_members').update(memberRowId, { role: 'owner' }))
  const ownerPb = await asUser(owner)
  await expectRefused(ownerPb.collection('team_members').update(memberRowId, { role: 'owner' }))
  await expectRefused(ownerPb.collection('team_members').update(ownerRowId, { user: member.id }))
  expect((await memberRow(team.id, member.id)).role).toBe('member')
  expect((await memberRow(team.id, owner.id)).role).toBe('owner')
})

// Design 5: "Only the owner removes members". A removed member loses access at once
// (plan, Review Focus: "a removed member loses access at once").
test('team_members: the owner removes a member, who immediately loses access to the team', async () => {
  const [owner, member] = [await createUser(), await createUser()]
  const team = await createTeam(owner)
  const rowId = await addMember(team.id, member)
  const memberPb = await asUser(member)
  expect(await memberPb.collection('teams').getFullList()).toHaveLength(1)

  await (await asUser(owner)).collection('team_members').delete(rowId)

  expect(await memberPb.collection('teams').getFullList()).toHaveLength(0)
  await expect(memberPb.collection('teams').getOne(team.id)).rejects.toMatchObject({ status: 404 })
  await expectNoRows(memberPb, 'team_members')
})

// D8: the owner cannot be removed, not even by themselves (a team without its owner row
// would hide the team from its owner).
test('team_members: the owner cannot delete their own owner row', async () => {
  const owner = await createUser()
  const team = await createTeam(owner)
  const ownerRowId = (await memberRow(team.id, owner.id)).id

  await expectRefused((await asUser(owner)).collection('team_members').delete(ownerRowId))
  expect((await memberRow(team.id, owner.id)).id).toBe(ownerRowId)
})

// D8: a plain member cannot remove anyone, themselves included (no leaving in the MVP).
test('team_members: a plain member cannot delete anyone, including themselves', async () => {
  const [owner, member, other] = [await createUser(), await createUser(), await createUser()]
  const team = await createTeam(owner)
  const memberRowId = await addMember(team.id, member)
  const otherRowId = await addMember(team.id, other)
  const ownerRowId = (await memberRow(team.id, owner.id)).id
  const pb = await asUser(member)

  for (const id of [memberRowId, otherRowId, ownerRowId]) {
    await expectRefused(pb.collection('team_members').delete(id))
  }
  expect(await teamRows('team_members', team.id)).toHaveLength(3)
})

// Design 6.8 ("Deleting a user ... removes them from teams") and the ERD: a plain
// member's account can be deleted and their memberships go with it; the account that
// owns a team cannot be deleted while the team exists (owner is required, no cascade).
test("team_members: deleting a member's account removes their memberships; deleting an owner's account is refused", async () => {
  const [owner, member] = [await createUser(), await createUser()]
  const team = await createTeam(owner)
  await addMember(team.id, member)
  const admin = await asAdmin()

  await admin.collection('users').delete(member.id)
  expect((await teamRows('team_members', team.id)).map((r) => r.user)).toEqual([owner.id])

  await expect(admin.collection('users').delete(owner.id)).rejects.toMatchObject({ status: 400 })
  expect((await admin.collection('teams').getOne(team.id)).owner).toBe(owner.id)
  expect((await memberRow(team.id, owner.id)).role).toBe('owner')
})

// D6: user_name is a copy kept in step by a hook, so a renamed member shows the new name.
test('team_members: user_name follows when a member changes their name', async () => {
  const [owner, member] = [await createUser(), await createUser()]
  await setName(member, 'Old Name')
  const team = await createTeam(owner)
  await addMember(team.id, member)
  expect((await memberRow(team.id, member.id)).user_name).toBe('Old Name')

  await setName(member, 'New Name')

  const rows = await (await asUser(owner)).collection('team_members').getFullList()
  expect(rows.find((r) => r.user === member.id)?.user_name).toBe('New Name')
})

// Injection strings must be treated as data (docs/security.md section 5).
test('team_members: an injection string in a filter returns nothing', async () => {
  const someone = await createUser()
  await createTeam(someone)
  const pb = await asUser(someone)
  await expectNoRows(pb, 'team_members', pb.filter('id = {:n}', { n: `' OR 1=1 --` }))
})
