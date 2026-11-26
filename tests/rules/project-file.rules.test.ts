import { expect, test } from 'vitest'
import { createLine, createNode, memberProject, type MemberProject } from './helpers/content.ts'
import { tokenOf } from './helpers/invites.ts'
import { asAdmin, asUser, createUser, PB_URL, type TestUser } from './helpers/pb.ts'
import { addMember } from './helpers/teams.ts'

// Protects design 10, security.md 5 "Bad imports" and plan 7 D4 and D5 (Review Focus 3):
// the project file is built and checked on the server. Only members export; only verified
// members import, into their own team; an import is all or nothing, and a refused file
// leaves nothing behind. The routes are GET /api/kwnto/projects/{id}/export and
// POST /api/kwnto/teams/{id}/import (backend/pb_hooks/project-file.pb.js).

const TOO_LARGE = 'This file is larger than the 5 MB import limit.'
const MAX_BYTES = 5242880
// PocketBase ends every error message with a full stop when it has none, so a problem such
// as `it is not JSON` arrives as `it is not JSON.`.
const NOT_A_PROJECT = 'This file is not a KWNTO project: '
type File = {
  format: string
  version: number
  project: { name: string; startNode: string | null }
  chapters: { id: string; title: string; position: number }[]
  nodes: { id: string; chapter: string; title: string }[]
  lines: { id: string; node: string; text: string }[]
  connections: { id: string; from: string; to: string | null; label: string }[]
}

async function call(
  token: string | undefined,
  path: string,
  init?: { method?: string; text?: string },
): Promise<Response> {
  const headers: Record<string, string> = {}
  if (token !== undefined) headers.Authorization = token
  if (init?.text !== undefined) headers['Content-Type'] = 'application/json'
  return fetch(`${PB_URL}${path}`, { method: init?.method ?? 'GET', headers, body: init?.text })
}

function exportPath(projectId: string): string {
  return `/api/kwnto/projects/${projectId}/export`
}

function importPath(teamId: string): string {
  return `/api/kwnto/teams/${teamId}/import`
}

// A project with two chapters (the second made by the member), three nodes, a line, a
// choice to another node, an empty choice and a start node.
async function storyProject(): Promise<MemberProject & { nodeIds: string[] }> {
  const ctx = await memberProject()
  const pb = await asUser(ctx.member)
  const chapter2 = (await pb.collection('chapters').create({ project: ctx.projectId, title: 'Second', position: 2 })).id
  const first = await createNode(ctx.member, ctx.projectId, ctx.chapterId, { title: 'Opening' })
  const second = await createNode(ctx.member, ctx.projectId, chapter2, { title: 'Later' })
  const third = await createNode(ctx.member, ctx.projectId, ctx.chapterId, { title: 'Side' })
  await createLine(ctx.member, ctx.projectId, first, { character: 'Mara', text: 'Hello there.' })
  await pb
    .collection('connections')
    .create({ project: ctx.projectId, from_node: first, to_node: second, label: 'Go on' })
  await pb
    .collection('connections')
    .create({ project: ctx.projectId, from_node: second, to_node: '', label: 'Open end' })
  return { ...ctx, nodeIds: [first, second, third] }
}

async function exportFile(user: TestUser, projectId: string): Promise<File> {
  const reply = await call(await tokenOf(user), exportPath(projectId))
  expect(reply.status).toBe(200)
  return (await reply.json()) as File
}

async function importText(user: TestUser | null, teamId: string, text: string): Promise<Response> {
  return call(user === null ? undefined : await tokenOf(user), importPath(teamId), { method: 'POST', text })
}

// What a team holds, read as the admin: the numbers a refused import must not change.
async function teamCounts(teamId: string): Promise<{ projects: number; chapters: number; nodes: number }> {
  const admin = await asAdmin()
  const where = (field: string) => admin.filter(`${field} = {:team}`, { team: teamId })
  return {
    projects: (await admin.collection('projects').getList(1, 1, { filter: where('team') })).totalItems,
    chapters: (await admin.collection('chapters').getList(1, 1, { filter: where('project.team') })).totalItems,
    nodes: (await admin.collection('nodes').getList(1, 1, { filter: where('project.team') })).totalItems,
  }
}

// Protects design 10 and security.md 2: members export their project's file; an outsider, a
// signed-out caller and an injection string get nothing (and the outsider no hint the id exists).
test('only members export a project', async () => {
  const ctx = await storyProject()
  const reply = await call(await tokenOf(ctx.member), exportPath(ctx.projectId))
  expect(reply.status).toBe(200)
  expect(reply.headers.get('content-disposition')).toBe('attachment; filename="Test-project.kwnto.json"')
  const file = (await reply.json()) as File
  // Readable in a text editor: the keys come in the documented order, and a node's keys too.
  expect(Object.keys(file)).toEqual([
    'format',
    'version',
    'exportedAt',
    'project',
    'chapters',
    'nodes',
    'lines',
    'cues',
    'connections',
    'media',
  ])
  expect(Object.keys(file.nodes[0])).toEqual(['id', 'chapter', 'title', 'color', 'x', 'y'])
  expect(file.format).toBe('kwnto-project')
  expect(file.version).toBe(1)
  expect(file.project.name).toBe('Test project')
  expect(file.chapters.map((c) => c.title)).toEqual(['Chapter 1', 'Second'])
  expect(file.nodes.map((n) => n.title).sort()).toEqual(['Later', 'Opening', 'Side'])
  expect(file.lines).toHaveLength(1)
  expect(file.lines[0].text).toBe('Hello there.')
  expect(file.connections.map((c) => c.label).sort()).toEqual(['Go on', 'Open end'])
  expect(file.connections.find((c) => c.label === 'Open end')?.to).toBeNull()
  expect(file.project.startNode).toBe(ctx.nodeIds[0])
  // No internal field (team, owner, version, created) is in the file.
  expect(JSON.stringify(file)).not.toContain(ctx.teamId)
  expect(JSON.stringify(file)).not.toContain(ctx.owner.id)

  const outsider = await createUser()
  const noAccess = await call(await tokenOf(outsider), exportPath(ctx.projectId))
  expect(noAccess.status).toBe(404)
  expect(await noAccess.json()).toMatchObject({ message: 'No project with this id.' })
  expect((await call(undefined, exportPath(ctx.projectId))).status).toBe(401)
  const injected = await call(await tokenOf(ctx.member), exportPath("' OR 1=1 --"))
  expect(injected.status).toBe(404)
  expect(await injected.json()).toMatchObject({ message: 'No project with this id.' })
})

// Protects plan D4 to D6: a member's import makes a new project (named "<name> (imported)")
// with new ids and the same structure, reusing Chapter 1 for the first chapter; importing
// twice makes two; the original is untouched; outsider, unverified member and signed-out
// callers are refused.
test('a member imports a file as a new project', async () => {
  const ctx = await storyProject()
  const text = JSON.stringify(await exportFile(ctx.member, ctx.projectId))
  const before = await teamCounts(ctx.teamId)
  const ids: string[] = []
  for (let round = 0; round < 2; round++) {
    const reply = await importText(ctx.member, ctx.teamId, text)
    expect(reply.status).toBe(200)
    ids.push(((await reply.json()) as { projectId: string }).projectId)
  }
  expect(ids[0]).not.toBe(ids[1])
  expect(ids).not.toContain(ctx.projectId)

  const admin = await asAdmin()
  const after = await teamCounts(ctx.teamId)
  expect(after).toEqual({ projects: before.projects + 2, chapters: before.chapters * 3, nodes: before.nodes * 3 })

  for (const id of ids) {
    const project = await admin.collection('projects').getOne(id)
    expect(project.name).toBe('Test project (imported)')
    expect(project.team).toBe(ctx.teamId)
    const copy = await exportFile(ctx.member, id)
    expect(copy.chapters.map((c) => c.title)).toEqual(['Chapter 1', 'Second'])
    expect(copy.nodes.map((n) => n.title).sort()).toEqual(['Later', 'Opening', 'Side'])
    expect(copy.lines.map((l) => l.text)).toEqual(['Hello there.'])
    const opening = copy.nodes.find((n) => n.title === 'Opening')
    const later = copy.nodes.find((n) => n.title === 'Later')
    expect(copy.project.startNode).toBe(opening?.id)
    expect(opening?.id).not.toBe(ctx.nodeIds[0])
    expect(copy.nodes.find((n) => n.id === later?.id)?.chapter).toBe(copy.chapters[1].id)
    expect(copy.connections.find((c) => c.label === 'Go on')).toMatchObject({ from: opening?.id, to: later?.id })
    expect(copy.connections.find((c) => c.label === 'Open end')?.to).toBeNull()
  }
  expect((await exportFile(ctx.member, ctx.projectId)).nodes).toHaveLength(3)

  const outsider = await createUser()
  const refused = await importText(outsider, ctx.teamId, text)
  expect(refused.status).toBe(404)
  expect(await refused.json()).toMatchObject({ message: 'No team with this id.' })
  const unverified = await createUser({ verified: false })
  await addMember(ctx.teamId, unverified)
  expect((await importText(unverified, ctx.teamId, text)).status).toBe(403)
  expect((await importText(null, ctx.teamId, text)).status).toBe(401)
  expect((await importText(ctx.member, "' OR 1=1 --", text)).status).toBe(404)
  expect(await teamCounts(ctx.teamId)).toEqual(after)
})

// Protects security.md 5 "Bad imports" and Review Focus 3: a file that is too big, not
// JSON, points at an unknown node or has too many nodes is refused with the reason, and the
// team has exactly what it had before (no project, chapter or node left half made).
test('a refused import creates nothing', async () => {
  const ctx = await storyProject()
  const base = await exportFile(ctx.member, ctx.projectId)
  const before = await teamCounts(ctx.teamId)

  const badLink: File = structuredClone(base)
  badLink.connections[badLink.connections.length - 1].to = 'no-such-node'
  const crowded: File = structuredClone(base)
  crowded.nodes = Array.from({ length: 2001 }, (_, i) => ({ id: `x${i}`, chapter: crowded.chapters[0].id, title: '' }))
  crowded.lines = []
  crowded.connections = []
  crowded.project.startNode = null

  const cases: [string, number, string][] = [
    ['a'.repeat(MAX_BYTES + 1), 413, TOO_LARGE],
    ['not json', 400, `${NOT_A_PROJECT}it is not JSON.`],
    [
      JSON.stringify(badLink),
      400,
      `${NOT_A_PROJECT}connections[${base.connections.length - 1}].to is not a node in the file.`,
    ],
    [JSON.stringify(crowded), 400, `${NOT_A_PROJECT}too many nodes (2001, at most 2000).`],
  ]
  for (const [text, status, message] of cases) {
    const reply = await importText(ctx.member, ctx.teamId, text)
    expect(reply.status, message).toBe(status)
    expect(await reply.json()).toMatchObject({ message })
    expect(await teamCounts(ctx.teamId)).toEqual(before)
  }
})

// Protects the all-or-nothing import (plan D4): a file that passes every check but that the
// database refuses halfway (two connections between the same two nodes break the pair
// index, after the project, chapters and nodes were already saved) is rolled back whole.
test('an import the database refuses halfway is rolled back', async () => {
  const ctx = await storyProject()
  const file = await exportFile(ctx.member, ctx.projectId)
  const first = file.connections.find((c) => c.to !== null)
  if (first === undefined) throw new Error('the story has a choice with a target')
  file.connections.push({ ...first, id: 'twin-of-first' })
  const before = await teamCounts(ctx.teamId)

  const reply = await importText(ctx.member, ctx.teamId, JSON.stringify(file))
  expect(reply.status).toBe(400)
  expect(await reply.json()).toMatchObject({ message: `${NOT_A_PROJECT}a record in it was refused.` })
  expect(await teamCounts(ctx.teamId)).toEqual(before)
})
