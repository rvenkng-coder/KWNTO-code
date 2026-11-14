import { send, tokenOf, type Reply } from './invites.ts'
import { asAdmin, asUser, type TestUser } from './pb.ts'

// Helpers for the content collections (projects, project_settings, chapters and, from
// Task 6, nodes, script_lines, cues and connections), whose updates go through the
// version guard (decision 0002; backend/pb_hooks/content-guard.pb.js).

// Creates a project through the member's own session (the create rule and the projects
// hook apply), then finds the settings row and the first chapter the hook made, as the admin.
export async function createProject(
  user: TestUser,
  teamId: string,
  name = 'Test project',
): Promise<{ id: string; chapterId: string; settingsId: string }> {
  const project = await (await asUser(user)).collection('projects').create({ team: teamId, name })
  const admin = await asAdmin()
  const filter = admin.filter('project = {:project}', { project: project.id })
  const settings = await admin.collection('project_settings').getFirstListItem(filter)
  const chapter = await admin.collection('chapters').getFirstListItem(filter)
  return { id: project.id, chapterId: chapter.id, settingsId: settings.id }
}

// A PATCH of one record as the user (or signed out with null), with the body sent as
// given, so a test can leave out `version` or send a wrong one. Never throws on an error
// status: the reply carries it.
export async function guardedUpdate(
  user: TestUser | null,
  collection: string,
  id: string,
  body: Record<string, unknown>,
): Promise<Reply> {
  const token = user === null ? undefined : await tokenOf(user)
  return send(token, `/api/collections/${collection}/records/${id}`, { method: 'PATCH', body })
}

// One record as stored, read as the admin (who bypasses every rule).
export async function readAsAdmin(collection: string, id: string): Promise<Record<string, unknown>> {
  return (await asAdmin()).collection(collection).getOne(id)
}
