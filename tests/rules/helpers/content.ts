import type PocketBase from 'pocketbase'
import { send, tokenOf, type Reply } from './invites.ts'
import { asAdmin, asUser, createTeam, createUser, type TestUser } from './pb.ts'
import { addMember } from './teams.ts'

// Helpers for the content collections (projects, project_settings, chapters, nodes, script_lines,
// cues and connections), whose updates go through the version guard (decision 0002;
// backend/pb_hooks/content-guard.pb.js).

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

// A team with an owner and one plain member, and a project the owner made in it.
export type MemberProject = {
  owner: TestUser
  member: TestUser
  teamId: string
  projectId: string
  chapterId: string
}

export async function memberProject(): Promise<MemberProject> {
  const [owner, member] = [await createUser(), await createUser()]
  const team = await createTeam(owner)
  await addMember(team.id, member)
  const project = await createProject(owner, team.id)
  return { owner, member, teamId: team.id, projectId: project.id, chapterId: project.chapterId }
}

// A fresh id of the form PocketBase and the editor use: 15 characters from a-z0-9.
export function clientId(): string {
  const alphabet = 'abcdefghijklmnopqrstuvwxyz0123456789'
  const bytes = crypto.getRandomValues(new Uint8Array(15))
  return Array.from(bytes, (b) => alphabet[b % alphabet.length]).join('')
}

// Creates a node through the user's own session (the create rule applies).
export async function createNode(
  user: TestUser,
  projectId: string,
  chapterId: string,
  extra: Record<string, unknown> = {},
): Promise<string> {
  const body = { project: projectId, chapter: chapterId, title: '', color: 'slate', x: 0, y: 0, ...extra }
  return (await (await asUser(user)).collection('nodes').create(body)).id
}

// Creates a script line through the user's own session (the create rule applies).
export async function createLine(
  user: TestUser,
  projectId: string,
  nodeId: string,
  extra: Record<string, unknown> = {},
): Promise<string> {
  const body = { project: projectId, node: nodeId, character: '', text: '', sort_order: 1, ...extra }
  return (await (await asUser(user)).collection('script_lines').create(body)).id
}

// One client's save, following the client rule of decision 0002: send with the version
// it read; on 409 re-read, re-apply only its own fields and send again, at most 20 tries.
// Returns how many 409 answers it met.
export async function saveOwnFields(
  pb: PocketBase,
  collection: string,
  id: string,
  readVersion: number,
  fields: Record<string, unknown>,
): Promise<number> {
  const maxTries = 20
  let version = readVersion
  for (let attempt = 0; attempt < maxTries; attempt++) {
    try {
      await pb.collection(collection).update(id, { ...fields, version })
      return attempt
    } catch (error) {
      if ((error as { status?: number }).status !== 409) throw error
      version = Number((await pb.collection(collection).getOne(id)).version)
    }
  }
  throw new Error(`no save after ${maxTries} tries`)
}
