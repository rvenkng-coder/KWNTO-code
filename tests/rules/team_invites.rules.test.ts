import { expect, test } from 'vitest'
import { expectNoRows, expectRefused } from './helpers/admin-only.ts'
import { asAdmin, asAnonymous, asUser, createTeam, createUser, type TestUser } from './helpers/pb.ts'
import { addMember, expectCreateRefused, expectNoEmail, expectNoEmailOf } from './helpers/teams.ts'

// Protects design section 5 (invite by email: "an owner never sees an invitee's email
// list"; the invitee sees the invite and must accept) and decision D7 (only the invitee
// sees an invite; there is no pending list for the owner). Also docs/security.md
// section 2 (deny by default): invites change only through the server's routes
// (backend/pb_hooks/teams-invites.pb.js), never through the collection API.
//
// The invites here are seeded as the admin, who bypasses every rule; the routes that
// make them for real are tested in teams.invites.rules.test.ts.

type Invite = Record<string, unknown> & { id: string }

async function setName(user: TestUser, name: string): Promise<void> {
  await (await asAdmin()).collection('users').update(user.id, { name })
}

async function seedInvite(
  teamId: string,
  invitee: TestUser,
  inviter: TestUser,
  teamName: string,
  inviterName: string,
): Promise<Invite> {
  return (await asAdmin()).collection('team_invites').create({
    team: teamId,
    invited_user: invitee.id,
    invited_by: inviter.id,
    status: 'pending',
    team_name: teamName,
    invited_by_name: inviterName,
  })
}

async function storedInvite(id: string): Promise<Invite> {
  return (await asAdmin()).collection('team_invites').getOne(id)
}

// A team owned by "Olive Owner" with one plain member, and one pending invite for a
// third person.
async function teamWithInvite(): Promise<{
  owner: TestUser
  member: TestUser
  invitee: TestUser
  teamId: string
  invite: Invite
}> {
  const [owner, member, invitee] = [await createUser(), await createUser(), await createUser()]
  await setName(owner, 'Olive Owner')
  const team = await createTeam(owner, 'Drama 101')
  await addMember(team.id, member)
  const invite = await seedInvite(team.id, invitee, owner, 'Drama 101', 'Olive Owner')
  return { owner, member, invitee, teamId: team.id, invite }
}

// Design 5: the invite appears in the invitee's account with the team's name and who
// sent it (copies, D6, because the invitee may not read the team or the owner's
// account), and only their own invites appear.
test('team_invites: the invited user lists and views their own invite with the team and inviter names', async () => {
  const { owner, invitee, teamId, invite } = await teamWithInvite()
  const otherInvitee = await createUser()
  await seedInvite(teamId, otherInvitee, owner, 'Drama 101', 'Olive Owner')
  const pb = await asUser(invitee)

  const rows = await pb.collection('team_invites').getFullList()
  expect(rows.map((row) => row.id)).toEqual([invite.id])
  const viewed = await pb.collection('team_invites').getOne(invite.id)
  expect(viewed).toMatchObject({
    team: teamId,
    status: 'pending',
    team_name: 'Drama 101',
    invited_by_name: 'Olive Owner',
  })
})

// D7: nobody but the invitee sees an invite: not the owner who sent it (no pending
// list), not another member, not an outsider, not a signed-out visitor.
test('team_invites: the owner, another member, an outsider and a signed-out visitor see no invite', async () => {
  const { owner, member, invite } = await teamWithInvite()
  const outsider = await createUser()

  for (const pb of [await asUser(owner), await asUser(member), await asUser(outsider), asAnonymous()]) {
    await expectNoRows(pb, 'team_invites')
    await expect(pb.collection('team_invites').getOne(invite.id)).rejects.toMatchObject({ status: 404 })
  }
})

// Deny by default: an invite is made by the invite route and answered by the accept and
// decline routes, which check who may do it. Through the collection API nobody may
// create, change or delete one, the invitee included (setting `status` to `accepted`
// directly would skip the membership the accept route makes, and the owner could
// otherwise write invites with any names).
test('team_invites: nobody can create, update or delete an invite through the API, the invitee included', async () => {
  const { owner, member, invitee, teamId, invite } = await teamWithInvite()
  const outsider = await createUser()
  const before = await storedInvite(invite.id)

  for (const pb of [
    await asUser(invitee),
    await asUser(owner),
    await asUser(member),
    await asUser(outsider),
    asAnonymous(),
  ]) {
    await expectCreateRefused(
      pb.collection('team_invites').create({
        team: teamId,
        invited_user: outsider.id,
        invited_by: owner.id,
        status: 'pending',
      }),
    )
    await expectRefused(pb.collection('team_invites').update(invite.id, { status: 'accepted' }))
    await expectRefused(pb.collection('team_invites').update(invite.id, { status: 'declined' }))
    await expectRefused(pb.collection('team_invites').delete(invite.id))
  }

  expect(await storedInvite(invite.id)).toEqual(before)
  const admin = await asAdmin()
  const all = await admin
    .collection('team_invites')
    .getFullList({ filter: admin.filter('team = {:team}', { team: teamId }) })
  expect(all.map((row) => row.id)).toEqual([invite.id])
})

// Design 5, emails are private: the invitee's list holds names, never an email, and
// expanding the relations cannot reach the inviter's account. (The invitee's own record
// may expand: the users rule shows each person their own record, as in team_members.)
test("team_invites: the invitee's list holds no email, and expanding cannot reach the inviter's", async () => {
  const { owner, member, invitee } = await teamWithInvite()
  const pb = await asUser(invitee)

  const rows = await pb.collection('team_invites').getFullList()
  expect(rows).toHaveLength(1)
  expectNoEmail(rows)
  for (const row of rows) {
    expect(Object.keys(row)).not.toContain('email')
  }
  const expanded = await pb
    .collection('team_invites')
    .getFullList({ expand: 'team,invited_by,invited_user,team.owner' })
  expectNoEmailOf(expanded, owner, member)
})

// Design 5 (one invite to answer, decision D7): one pending invite per person per team,
// held by the database itself, so even a write that skips the invite route (the admin
// dashboard) cannot make a second one. Answered invites stay as history, so a declined
// person can get a new pending invite.
test('team_invites: the table holds at most one pending invite per person and team', async () => {
  const { owner, invitee, teamId, invite } = await teamWithInvite()
  const admin = await asAdmin()

  await expect(seedInvite(teamId, invitee, owner, 'Drama 101', 'Olive Owner')).rejects.toMatchObject({ status: 400 })
  await admin.collection('team_invites').update(invite.id, { status: 'declined' })
  const again = await seedInvite(teamId, invitee, owner, 'Drama 101', 'Olive Owner')
  await expect(admin.collection('team_invites').update(invite.id, { status: 'pending' })).rejects.toMatchObject({
    status: 400,
  })

  expect((await storedInvite(again.id)).status).toBe('pending')
  expect((await storedInvite(invite.id)).status).toBe('declined')
})

// docs/security.md section 5: a filter value is data. An injection string must not
// widen the invitee's (or anyone's) list.
test('team_invites: an injection string in a filter returns nothing', async () => {
  const { owner, invitee } = await teamWithInvite()

  for (const pb of [await asUser(invitee), await asUser(owner)]) {
    await expectNoRows(pb, 'team_invites', pb.filter('id = {:n}', { n: `' OR 1=1 --` }))
    await expectNoRows(pb, 'team_invites', pb.filter('team_name = {:n}', { n: `x' || invited_user != '` }))
  }
})
