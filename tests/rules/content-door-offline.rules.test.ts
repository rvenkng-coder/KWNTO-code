// Protects the door's offline-sync additions (offline sync plan Task 2) against a live PocketBase:
// `get` reads one record or null; an update with `shouldRetry` stops on a real conflict and still
// merges a change to another field; creating an id that exists is refused on the id field.
import { expect, test } from 'vitest'
import { createBackend, type Backend } from '../../frontend/src/backend/client'
import { EditConflict } from '../../frontend/src/backend/errors'
import { createTeam, createUser, PB_URL, type TestUser } from './helpers/pb'
import { addMember } from './helpers/teams'
import { clientId, readAsAdmin } from './helpers/content'

async function doorFor(user: TestUser): Promise<Backend> {
  const door = createBackend(PB_URL)
  await door.auth.signIn(user.email, user.password)
  return door
}

// A team with two members and an outsider; a project with one node.
async function setup() {
  const [owner, member, outsider] = [await createUser(), await createUser(), await createUser()]
  const team = await createTeam(owner)
  await addMember(team.id, member)
  const [a, b, out] = [await doorFor(owner), await doorFor(member), await doorFor(outsider)]
  const project = await b.projects.create(team.id, 'Story')
  const chapter = (await b.content.load(project.id)).chapters[0]
  if (!chapter) throw new Error('the project has no chapter')
  const node = await b.content.create('nodes', {
    id: clientId(), projectId: project.id, chapterId: chapter.id, title: 'base title', color: 'slate', x: 0, y: 0, deleted: false, version: 0,
  })
  return { a, b, out, project, chapterId: chapter.id, node }
}

// Protects: the sync engine can check whether a record still exists; an outsider sees the same as a missing id.
test('get returns a record or null', async () => {
  const { a, out, project, node } = await setup()
  expect(await a.content.get('nodes', node.id)).toMatchObject({ id: node.id, title: 'base title', projectId: project.id })
  expect(await a.content.get('nodes', clientId())).toBeNull()
  expect(await out.content.get('nodes', node.id)).toBeNull()
})

// Protects: decision 0002 "or the conflict dialog": an offline edit meeting a change to the same field stops and keeps the teammate's value.
test('an offline edit that meets a change to the same field is stopped', async () => {
  const { a, b, node } = await setup()
  await b.content.update('nodes', node.id, { title: 'theirs' }, node.version)
  const error = await a.content.update('nodes', node.id, { title: 'mine' }, node.version, {
    shouldRetry: (cur) => cur.title === 'base title',
  }).catch((e: unknown) => e)
  expect(error).toBeInstanceOf(EditConflict)
  expect((error as EditConflict<{ title: string }>).server.title).toBe('theirs')
  expect((await readAsAdmin('nodes', node.id)).title).toBe('theirs')
})

// Protects: design 5 / decision 0002: an edit of a different field is merged, not a conflict.
test('an offline edit of another field is merged without a conflict', async () => {
  const { a, b, node } = await setup()
  await b.content.update('nodes', node.id, { color: 'red' }, node.version)
  const saved = await a.content.update('nodes', node.id, { title: 'mine' }, node.version, {
    shouldRetry: (cur) => cur.title === 'base title',
  })
  const stored = await readAsAdmin('nodes', node.id)
  expect(stored.title).toBe('mine')
  expect(stored.color).toBe('red')
  expect(saved.version).toBe(node.version + 2)
})

// Protects: the engine's "lost answer" rule: sending a create again is told apart by the id field.
test('creating an id that exists is refused on the id field', async () => {
  const { b, project, node } = await setup()
  const line = { id: clientId(), projectId: project.id, nodeId: node.id, character: '', text: 'x', sortOrder: 1, version: 0 }
  await b.content.create('script_lines', line)
  const error = await b.content.create('script_lines', line).catch((e: unknown) => e)
  expect(error).toMatchObject({ kind: 'invalid' })
  expect(Object.keys((error as { fields: object }).fields)).toContain('id')
  const stored = (await b.content.load(project.id)).lines.filter((l) => l.id === line.id)
  expect(stored).toHaveLength(1)
})
