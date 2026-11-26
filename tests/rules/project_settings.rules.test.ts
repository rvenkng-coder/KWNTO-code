import { expect, test } from 'vitest'
import { expectNoRows, expectRefused } from './helpers/admin-only.ts'
import { createProject, guardedUpdate, readAsAdmin } from './helpers/content.ts'
import { asAnonymous, asUser, createTeam, createUser } from './helpers/pb.ts'
import { addMember, expectCreateRefused } from './helpers/teams.ts'

// Protects design section 5 (teams own projects; members edit them; only the owner
// deletes one) for a project's settings row, plan decision D6 (exactly one row per
// project, made with it, analytics off by default) and docs/security.md section 2
// (deny by default: outsiders and signed-out callers get nothing).

// D6: members change the settings; the row itself is made and removed only with the project.
test('members edit project settings and nobody creates or deletes them', async () => {
  const [owner, member, outsider] = [await createUser(), await createUser(), await createUser()]
  const team = await createTeam(owner)
  await addMember(team.id, member)
  const project = await createProject(owner, team.id)

  const edited = await guardedUpdate(member, 'project_settings', project.settingsId, {
    version: 0,
    analytics_enabled: true,
  })
  expect(edited.status).toBe(200)
  expect(await readAsAdmin('project_settings', project.settingsId)).toMatchObject({
    analytics_enabled: true,
    version: 1,
  })

  for (const user of [owner, member]) {
    const pb = await asUser(user)
    await expectCreateRefused(
      pb.collection('project_settings').create({ project: project.id, analytics_enabled: true }),
    )
    await expectRefused(pb.collection('project_settings').delete(project.settingsId))
  }

  for (const caller of [outsider, null]) {
    const reply = await guardedUpdate(caller, 'project_settings', project.settingsId, {
      version: 1,
      analytics_enabled: false,
    })
    expect([403, 404]).toContain(reply.status)
  }
  for (const pb of [await asUser(outsider), asAnonymous()]) {
    await expectNoRows(pb, 'project_settings')
    await expectRefused(pb.collection('project_settings').getOne(project.settingsId))
  }
  expect(await readAsAdmin('project_settings', project.settingsId)).toMatchObject({
    analytics_enabled: true,
    version: 1,
  })
})
