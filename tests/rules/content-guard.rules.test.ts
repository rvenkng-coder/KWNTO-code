import type PocketBase from 'pocketbase'
import { expect, test } from 'vitest'
import { createNode, createProject, guardedUpdate, readAsAdmin, saveOwnFields as saveFields } from './helpers/content.ts'
import { asUser, createTeam, createUser } from './helpers/pb.ts'
import { addMember } from './helpers/teams.ts'

// Protects decision 0002 (option 2) and Review Focus 1 of the editor core plan: two
// people editing different fields of the same record at the same moment both keep their
// edit. The spike measured plain PocketBase updates losing up to 13 of 20 such edits;
// the version guard (backend/pb_hooks/content-guard.pb.js) must lose none, and a refused
// write must change nothing (design 5: saving per attribute; security.md section 2 for
// the members-only access the guard runs behind).

const ROUNDS = 20
const MAX_TRIES = 20

type Fields = Record<string, unknown>

// One client's save, following the client rule of decision 0002: send with the version
// it read; on 409 re-read, re-apply only its own fields and send again, at most 20 tries.
// Returns how many 409 answers it met.
async function saveOwnFields(pb: PocketBase, id: string, readVersion: number, fields: Fields): Promise<number> {
  let version = readVersion
  for (let attempt = 0; attempt < MAX_TRIES; attempt++) {
    try {
      await pb.collection('chapters').update(id, { ...fields, version })
      return attempt
    } catch (error) {
      if ((error as { status?: number }).status !== 409) throw error
      version = Number((await pb.collection('chapters').getOne(id)).version)
    }
  }
  throw new Error(`no save after ${MAX_TRIES} tries`)
}

async function twoMembersOnOneChapter(): Promise<{ first: PocketBase; second: PocketBase; chapterId: string }> {
  const [owner, member] = [await createUser(), await createUser()]
  const team = await createTeam(owner)
  await addMember(team.id, member)
  const project = await createProject(owner, team.id)
  return { first: await asUser(owner), second: await asUser(member), chapterId: project.chapterId }
}

// Decision 0002, A2: every round keeps both fields, the version rises by exactly 2, and
// exactly one of the two writers had to retry.
test('parallel edits of different fields both survive', async () => {
  const { first, second, chapterId } = await twoMembersOnOneChapter()

  for (let round = 1; round <= ROUNDS; round++) {
    const before = Number((await readAsAdmin('chapters', chapterId)).version)
    const title = `Round ${round} ${crypto.randomUUID()}`
    const position = round + 0.25

    const conflicts = await Promise.all([
      saveOwnFields(first, chapterId, before, { title }),
      saveOwnFields(second, chapterId, before, { position }),
    ])

    const after = await readAsAdmin('chapters', chapterId)
    expect(after, `round ${round}`).toMatchObject({ title, position, version: before + 2 })
    expect(conflicts[0] + conflicts[1], `409 answers in round ${round}`).toBe(1)
  }
}, 60_000)

// A 409 is decided before any field is written, inside the same transaction, so a stale
// write that changes two fields leaves both, and the version, as they were.
test('a refused update changes nothing', async () => {
  const owner = await createUser()
  const team = await createTeam(owner)
  const { chapterId } = await createProject(owner, team.id)

  expect((await guardedUpdate(owner, 'chapters', chapterId, { version: 0, title: 'Saved first' })).status).toBe(200)
  const stale = await guardedUpdate(owner, 'chapters', chapterId, { version: 0, title: 'Stale', position: 9 })

  expect(stale.status).toBe(409)
  expect(await readAsAdmin('chapters', chapterId)).toMatchObject({ title: 'Saved first', position: 1, version: 1 })
})

// Protects decision 0002's open question "more than two simultaneous writers" (editor core
// plan, Task 14, C1): four members each change a different field of one node at the same
// moment, retrying on 409 as the door does (frontend/src/backend/guarded.ts); every round
// keeps all four values and the version rises by exactly 4 (one write per member).
test('four people editing one node at once all keep their change', async () => {
  const owner = await createUser()
  const others = [await createUser(), await createUser(), await createUser()]
  const team = await createTeam(owner)
  for (const member of others) await addMember(team.id, member)
  const project = await createProject(owner, team.id)
  const nodeId = await createNode(owner, project.id, project.chapterId)
  const writers = await Promise.all([owner, ...others].map((user) => asUser(user)))
  const colors = ['red', 'green', 'teal', 'purple', 'amber']

  for (let round = 1; round <= 10; round++) {
    const before = Number((await readAsAdmin('nodes', nodeId)).version)
    const fields = [{ title: `Round ${round}` }, { color: colors[round % colors.length] }, { x: round * 10 }, { y: round * -7 }]
    await Promise.all(fields.map((f, i) => saveFields(writers[i], 'nodes', nodeId, before, f)))
    const after = await readAsAdmin('nodes', nodeId)
    expect(after, `round ${round}`).toMatchObject({ ...Object.assign({}, ...fields), version: before + 4 })
  }
}, 120_000)
