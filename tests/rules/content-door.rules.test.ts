// Protects the content door (editor core plan Task 7) end to end: door -> routes -> rules
// -> version guard. Projects are listed for members only; `load` returns a whole project
// in editor types; two people saving different fields of one node at once both keep their
// change, because the door retries a 409 itself (decision 0002); and an outsider is
// refused. A teammate's changes arrive live as editor events (plan D15), and nothing of
// the project reaches an outsider. Each person drives their own `createBackend(PB_URL)`.
import { expect, test } from 'vitest'
import { createBackend, type Backend } from '../../frontend/src/backend/client'
import type { RemoteEvent } from '../../frontend/src/backend/content-types'
import { asAdmin, createTeam, createUser, PB_URL, type TestUser } from './helpers/pb'
import { addMember } from './helpers/teams'
import { clientId } from './helpers/content'

async function doorFor(user: TestUser): Promise<Backend> {
  const door = createBackend(PB_URL)
  await door.auth.signIn(user.email, user.password)
  return door
}

// A team with an owner and a member, a project the member made through the door, and an
// outsider who belongs to another team.
async function setup() {
  const [owner, member, outsider] = [await createUser(), await createUser(), await createUser()]
  const team = await createTeam(owner)
  await addMember(team.id, member)
  const [a, b, out] = [await doorFor(owner), await doorFor(member), await doorFor(outsider)]
  const project = await b.projects.create(team.id, 'Story')
  return { teamId: team.id, a, b, out, project }
}

async function firstChapterId(door: Backend, projectId: string): Promise<string> {
  const content = await door.content.load(projectId)
  const chapter = content.chapters[0]
  if (!chapter) throw new Error('the project has no chapter')
  return chapter.id
}

function node(projectId: string, chapterId: string, title: string) {
  return { id: clientId(), projectId, chapterId, title, color: 'slate' as const, x: 0, y: 0, deleted: false, version: 0 }
}

// Protects: a team's projects are listed to its members only, trashed ones hidden, newest change first.
test('projects are listed for members only', async () => {
  const { teamId, a, b, out, project } = await setup()
  const trashed = await a.projects.create(teamId, 'Old')
  await a.content.update('projects', trashed.id, { deleted: true }, trashed.version)

  const listed = await b.projects.list(teamId)
  expect(listed).toEqual([{ id: project.id, teamId, name: 'Story', startNodeId: null, deleted: false, deletedAt: null, version: project.version }])

  const second = await b.projects.create(teamId, 'Second')
  expect((await b.projects.list(teamId)).map((p) => p.name)).toEqual(['Second', 'Story'])
  await b.content.update('projects', project.id, { name: 'Story 2' }, project.version)
  expect((await b.projects.list(teamId)).map((p) => p.id)).toEqual([project.id, second.id])

  expect(await out.projects.list(teamId)).toEqual([])
})

// Protects: the editor opens a project with one call that returns all of it in editor types.
test('load returns the whole project', async () => {
  const { b, project } = await setup()
  const chapter = await b.content.create('chapters', {
    id: clientId(), projectId: project.id, title: 'Two', position: 2, deleted: false, version: 0,
  })
  const first = await b.content.create('nodes', node(project.id, chapter.id, 'First'))
  const second = await b.content.create('nodes', node(project.id, chapter.id, 'Second'))
  const line = await b.content.create('script_lines', {
    id: clientId(), projectId: project.id, nodeId: first.id, character: 'Ann', text: 'Hi', sortOrder: 1, version: 0,
  })
  const cue = await b.content.create('cues', {
    id: clientId(), projectId: project.id, nodeId: first.id, type: 'audio', text: 'Bell', sortOrder: 1, version: 0,
  })
  const link = await b.content.create('connections', {
    id: clientId(), projectId: project.id, fromNodeId: first.id, toNodeId: second.id, label: 'Go', version: 0,
  })

  const content = await b.content.load(project.id)

  expect(content.project).toMatchObject({ id: project.id, name: 'Story', startNodeId: first.id, deleted: false })
  expect(content.settings).toMatchObject({ projectId: project.id, analyticsEnabled: false })
  expect(content.chapters.map((c) => c.title).sort()).toEqual(['Chapter 1', 'Two'])
  expect(content.nodes.map((n) => n.id).sort()).toEqual([first.id, second.id].sort())
  expect(content.nodes.find((n) => n.id === first.id)).toEqual(first)
  expect(content.lines).toEqual([line])
  expect(content.cues).toEqual([cue])
  expect(content.connections).toEqual([link])
})

// Protects: Review Focus 1 through the door: concurrent saves of different fields both survive a real 409.
test('two people editing one node both keep their change', async () => {
  const { a, b, project } = await setup()
  const created = await b.content.create('nodes', node(project.id, await firstChapterId(b, project.id), 'Start'))

  const [fromA, fromB] = await Promise.all([
    a.content.update('nodes', created.id, { title: 'Renamed' }, created.version),
    b.content.update('nodes', created.id, { x: 120 }, created.version),
  ])

  expect(fromA.title).toBe('Renamed')
  expect(fromB.x).toBe(120)
  const stored = await (await asAdmin()).collection('nodes').getOne(created.id)
  expect(stored.title).toBe('Renamed')
  expect(stored.x).toBe(120)
  expect(stored.version).toBe(2)
})

// Protects: an outsider can neither read, change nor add to a project, and the door reports it as a refusal.
test('the door refuses outsiders', async () => {
  const { b, out, project } = await setup()
  const chapterId = await firstChapterId(b, project.id)
  const created = await b.content.create('nodes', node(project.id, chapterId, 'Mine'))
  const refusals = ['not-found', 'forbidden']

  const load = await out.content.load(project.id).catch((e: unknown) => e)
  expect(refusals).toContain((load as { kind?: string }).kind)

  const update = await out.content.update('nodes', created.id, { title: 'Theirs' }, created.version).catch((e: unknown) => e)
  expect(refusals).toContain((update as { kind?: string }).kind)

  const create = await out.content.create('nodes', node(project.id, chapterId, 'Intruder')).catch((e: unknown) => e)
  expect(refusals).toContain((create as { kind?: string }).kind)

  const admin = await asAdmin()
  const stored = await admin.collection('nodes').getFullList({ filter: admin.filter('project = {:p}', { p: project.id }) })
  expect(stored.map((n) => n.title)).toEqual(['Mine'])
})

// Collects events and waits for one that matches, without fixed sleeps.
function recorder() {
  const events: RemoteEvent[] = []
  const waiting: Array<{ match: (e: RemoteEvent) => boolean; resolve: (e: RemoteEvent) => void }> = []
  function onEvent(event: RemoteEvent): void {
    events.push(event)
    for (const w of waiting.filter((x) => x.match(event))) {
      waiting.splice(waiting.indexOf(w), 1)
      w.resolve(event)
    }
  }
  function next(match: (e: RemoteEvent) => boolean): Promise<RemoteEvent> {
    const seen = events.find(match)
    return seen ? Promise.resolve(seen) : new Promise((resolve) => waiting.push({ match, resolve }))
  }
  return { events, onEvent, next }
}

// Protects: plan D15: a teammate's rename, trash and delete reach the open editor as mapped events.
test("a teammate's changes arrive as events", async () => {
  const { a, b, project } = await setup()
  const chapter = await b.content.create('chapters', {
    id: clientId(), projectId: project.id, title: 'Two', position: 2, deleted: false, version: 0,
  })
  const created = await b.content.create('nodes', node(project.id, chapter.id, 'Old'))
  const line = await b.content.create('script_lines', {
    id: clientId(), projectId: project.id, nodeId: created.id, character: 'Ann', text: 'Bye', sortOrder: 1, version: 0,
  })
  const seen = recorder()
  const close = await a.content.subscribe(project.id, seen.onEvent)

  await b.content.update('nodes', created.id, { title: 'New' }, created.version)
  await b.content.update('chapters', chapter.id, { deleted: true }, chapter.version)
  await b.content.remove('script_lines', line.id)

  const renamed = await seen.next((e) => e.kind === 'nodes' && e.record.id === created.id)
  expect(renamed).toEqual({ kind: 'nodes', action: 'update', record: { ...created, title: 'New', version: 1 } })
  const trashed = await seen.next((e) => e.kind === 'chapters' && e.record.id === chapter.id)
  expect(trashed).toMatchObject({ kind: 'chapters', action: 'update', record: { id: chapter.id, deleted: true, version: 1 } })
  const removed = await seen.next((e) => e.kind === 'script_lines')
  expect(removed).toEqual({ kind: 'script_lines', action: 'delete', record: line })
  await close()
})

// Protects: live events never leak outside the project (decision 0002 finding D); a control event proves the stream works.
test('an outsider receives no events of the project', async () => {
  const { b, out, project } = await setup()
  const created = await b.content.create('nodes', node(project.id, await firstChapterId(b, project.id), 'Secret'))
  const outsiderTeam = await out.teams.create('Elsewhere')
  const own = await out.projects.create(outsiderTeam.id, 'Own')
  const seen = recorder()
  const closeForeign = await out.content.subscribe(project.id, seen.onEvent)
  const closeOwn = await out.content.subscribe(own.id, seen.onEvent)

  await b.content.update('nodes', created.id, { title: 'Still secret' }, created.version)
  await b.content.update('projects', project.id, { name: 'Renamed' }, project.version)
  await out.content.update('projects', own.id, { name: 'Control' }, own.version)

  await seen.next((e) => e.kind === 'projects' && e.record.id === own.id)
  expect(seen.events.map((e) => e.record.id)).toEqual([own.id])
  await closeForeign()
  await closeOwn()
})

// Protects: plan D15 and design 8b for records a teammate makes: a new node (the first one,
// which also becomes the start node, and a later one), a line and a connection each reach the
// open editor as a create event. Found by Task 14's two-browser test: the start-node hook ran
// the node's insert inside its own transaction, and PocketBase then sent no create event.
test("a teammate's new records arrive as create events", async () => {
  const { a, b, project } = await setup()
  const chapterId = await firstChapterId(b, project.id)
  const seen = recorder()
  const close = await a.content.subscribe(project.id, seen.onEvent)

  const first = await b.content.create('nodes', node(project.id, chapterId, 'First'))
  const second = await b.content.create('nodes', node(project.id, chapterId, 'Second'))
  const line = await b.content.create('script_lines', {
    id: clientId(), projectId: project.id, nodeId: first.id, character: '', text: 'Hi', sortOrder: 1, version: 0,
  })
  const link = await b.content.create('connections', {
    id: clientId(), projectId: project.id, fromNodeId: first.id, toNodeId: second.id, label: '', version: 0,
  })

  // A later edit on the same stream: once it has arrived, every earlier event has too.
  await b.content.update('nodes', second.id, { title: 'Control' }, second.version)
  await seen.next((e) => e.action === 'update' && e.record.id === second.id)

  const creates = seen.events.filter((e) => e.action === 'create').map((e) => e.record)
  expect(creates).toEqual([first, second, line, link])
  await close()
})
