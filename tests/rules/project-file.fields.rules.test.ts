import type PocketBase from 'pocketbase'
import { expect, test } from 'vitest'
import { createCarriedProject } from './helpers/carried.ts'
import { CARRIED, NOT_IMPORTED, NEVER_CARRIED } from './helpers/file-contract.ts'
import { asAdmin, asUser, rawSend } from './helpers/pb.ts'

type Row = Record<string, unknown>

async function rowsOf(admin: PocketBase, collection: string, projectId: string): Promise<Row[]> {
  const field = collection === 'projects' ? 'id' : 'project'
  return admin.collection(collection).getFullList({ filter: admin.filter(`${field} = {:p}`, { p: projectId }) })
}

// The carried fields of every record of one project, with ids replaced by the title of the record
// they point at, so an original and its copy (which has new ids) compare equal.
async function carriedContent(projectId: string): Promise<Record<string, Row[]>> {
  const admin = await asAdmin()
  const titles = new Map<unknown, unknown>()
  for (const collection of ['chapters', 'nodes']) {
    for (const row of await rowsOf(admin, collection, projectId)) titles.set(row.id, row.title)
  }
  const out: Record<string, Row[]> = {}
  for (const [collection, fields] of Object.entries(CARRIED)) {
    const rows = await rowsOf(admin, collection, projectId)
    out[collection] = rows
      .map((row) => Object.fromEntries(fields.map((f) => [f, titles.get(row[f]) ?? row[f]])))
      .sort((a, b) => JSON.stringify(a).localeCompare(JSON.stringify(b)))
  }
  return out
}

// Protects design 10: a new collection or field of a project cannot be forgotten by export and
// import. Each one is either carried (and then proven by the round trip below) or listed with the
// reason it is left out, in helpers/file-contract.ts. Node sizes and node links were forgotten
// this way once.
test('every project field is carried by the project file or excluded with a reason', async () => {
  const all = await (await asAdmin()).collections.getFullList()
  const projects = all.find((c) => c.name === 'projects')
  const ofProject = all.filter((c) => c.name === 'projects' || c.fields.some((f) => f.name === 'project' && f.collectionId === projects?.id))

  const classified = [...Object.keys(CARRIED), ...Object.keys(NOT_IMPORTED)]
  expect(ofProject.map((c) => c.name).sort()).toEqual(classified.sort())

  for (const collection of ofProject.filter((c) => c.name in CARRIED)) {
    const excluded = Object.keys(NEVER_CARRIED[collection.name] ?? {})
    const listed = [...(CARRIED[collection.name] ?? []), ...excluded]
    const stored = collection.fields.map((f) => f.name)
    expect(stored.sort(), collection.name).toEqual(listed.sort())
  }
})

// Protects design 10: every field listed as carried is the same in an imported copy. The source
// holds a value in each of them, so an empty default cannot pass for a value that survived.
test('every carried field is the same after export and import', async () => {
  const ctx = await createCarriedProject()
  const source = await carriedContent(ctx.projectId)
  for (const [collection, fields] of Object.entries(CARRIED)) {
    for (const field of fields) expect(source[collection]?.some((row) => row[field]), `${collection}.${field} is empty`).toBe(true)
  }

  const token = (await asUser(ctx.member)).authStore.token
  const exported = await rawSend(token, `/api/kwnto/projects/${ctx.projectId}/export`)
  expect(exported.status).toBe(200)
  const imported = await rawSend(token, `/api/kwnto/teams/${ctx.teamId}/import`, { method: 'POST', body: await exported.json() })
  expect(imported.status).toBe(200)
  const { projectId } = (await imported.json()) as { projectId: string }

  const copy = await carriedContent(projectId)
  expect(copy).toEqual({ ...source, projects: source.projects?.map((p) => ({ ...p, name: `${String(p.name)} (imported)` })) })
  const links = await rowsOf(await asAdmin(), 'node_links', projectId)
  expect(links.map((l) => l.creator)).toEqual([ctx.member.id])
})
