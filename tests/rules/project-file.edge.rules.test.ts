import { expect, test } from 'vitest'
import { createNode, guardedUpdate, memberProject, readAsAdmin } from './helpers/content.ts'
import { tokenOf } from './helpers/invites.ts'
import { asAdmin, asUser, PB_URL, type TestUser } from './helpers/pb.ts'

// Protects security.md 5 "Bad imports": an exported file always imports again (choices to trashed
// nodes), hostile bodies (deeply nested JSON, a streamed body of unknown length) are refused
// without hurting the server, and a file at every limit imports in a reasonable time without
// blocking other requests. Routes: backend/pb_hooks/project-file.pb.js.

type Connection = { id: string; from: string; to: string | null; label: string }
type File = { chapters: unknown[]; nodes: { id: string; title: string }[]; connections: Connection[] }

function post(token: string, teamId: string, body: BodyInit, extra: RequestInit = {}): Promise<Response> {
  return fetch(`${PB_URL}/api/kwnto/teams/${teamId}/import`, {
    method: 'POST',
    headers: { Authorization: token, 'Content-Type': 'application/json' },
    body,
    ...extra,
  })
}

async function exportFile(user: TestUser, projectId: string): Promise<File> {
  const reply = await fetch(`${PB_URL}/api/kwnto/projects/${projectId}/export`, {
    headers: { Authorization: await tokenOf(user) },
  })
  expect(reply.status).toBe(200)
  return (await reply.json()) as File
}

async function trash(user: TestUser, nodeId: string): Promise<void> {
  const version = Number((await readAsAdmin('nodes', nodeId)).version)
  const reply = await guardedUpdate(user, 'nodes', nodeId, { deleted_at: new Date().toISOString(), version })
  expect(reply.status).toBe(200)
}

async function healthy(): Promise<boolean> {
  return (await fetch(`${PB_URL}/api/health`)).status === 200
}

// Protects the export/import round trip: node A has choices to two trashed nodes and an
// open choice. The file keeps them as three choices with no target, and the import accepts
// the file and makes them (the pair index only covers choices that have a target).
test('choices to trashed nodes survive an export and an import', async () => {
  const ctx = await memberProject()
  const pb = await asUser(ctx.member)
  const ids: string[] = []
  for (const title of ['A', 'B', 'C', 'D']) {
    ids.push(await createNode(ctx.member, ctx.projectId, ctx.chapterId, { title }))
  }
  const [nodeA, nodeB, nodeC, nodeD] = ids
  for (const [to, label] of [
    [nodeB, 'to B'],
    [nodeC, 'to C'],
    [nodeD, 'to D'],
    ['', 'open'],
  ]) {
    await pb.collection('connections').create({ project: ctx.projectId, from_node: nodeA, to_node: to, label })
  }
  await trash(ctx.member, nodeB)
  await trash(ctx.member, nodeC)

  const file = await exportFile(ctx.member, ctx.projectId)
  const fromA = file.connections.filter((k) => k.from === file.nodes.find((n) => n.title === 'A')?.id)
  expect(
    fromA
      .filter((k) => k.to === null)
      .map((k) => k.label)
      .sort(),
  ).toEqual(['open', 'to B', 'to C'])
  expect(fromA).toHaveLength(4)

  const reply = await post(await tokenOf(ctx.member), ctx.teamId, JSON.stringify(file))
  expect(reply.status).toBe(200)
  const { projectId } = (await reply.json()) as { projectId: string }
  const copy = await exportFile(ctx.member, projectId)
  expect(copy.connections.map((k) => k.label).sort()).toEqual(['open', 'to B', 'to C', 'to D'])
})

// Protects security.md 5: JSON nested millions of levels deep is refused (400 or 413) and
// the server keeps answering afterwards. Two bodies of about 5 MB each go up, which the default
// 5 s limit is too tight for on a slow CI runner (it has timed out there).
test('deeply nested JSON is refused and the server survives', { timeout: 60_000 }, async () => {
  const ctx = await memberProject()
  const token = await tokenOf(ctx.member)
  for (const body of ['['.repeat(5_000_000), '{"a":'.repeat(1_000_000)]) {
    const reply = await post(token, ctx.teamId, body)
    expect([400, 413]).toContain(reply.status)
    expect(await healthy()).toBe(true)
  }
})

// Protects the size check for a body of unknown length: a chunked upload over 5 MB gets 413
// (no Content-Length to check, so the bytes read are counted).
test('a streamed body over the limit is refused', async () => {
  const ctx = await memberProject()
  const chunk = new TextEncoder().encode('a'.repeat(1024 * 1024))
  let sent = 0
  const stream = new ReadableStream<Uint8Array>({
    pull(controller) {
      if (sent === 6) controller.close()
      else controller.enqueue(chunk)
      sent += 1
    },
  })
  const reply = await post(await tokenOf(ctx.member), ctx.teamId, stream, { duplex: 'half' } as RequestInit)
  expect(reply.status).toBe(413)
  expect(await reply.json()).toMatchObject({ message: 'This file is larger than the 5 MB import limit.' })
})

// Protects the limits as numbers someone can live with: a valid file with 200 chapters,
// 2,000 nodes, 20,000 lines, 10,000 cues and 10,000 connections imports; the duration is
// printed for progress.md. "Without blocking" holds for reads: the database has one write connection, so another person's write
// waits for the import (docs/security.md says so); it must still complete, and its wait is printed.
test('a file at every limit imports in time without blocking others', { timeout: 300_000 }, async () => {
  const ctx = await memberProject()
  const writer = await createNode(ctx.member, ctx.projectId, ctx.chapterId, { title: 'probe' })
  const nodes = Array.from({ length: 2000 }, (_, i) => ({
    id: `n${i}`,
    chapter: `c${i % 200}`,
    title: `Node ${i}`,
    color: 'slate',
    x: i,
    y: i,
  }))
  const file = {
    format: 'kwnto-project',
    version: 1,
    exportedAt: 'now',
    project: { name: 'Big', startNode: 'n0' },
    chapters: Array.from({ length: 200 }, (_, i) => ({ id: `c${i}`, title: `Chapter ${i}`, position: i })),
    nodes,
    lines: Array.from({ length: 20000 }, (_, i) => ({
      id: `l${i}`,
      node: `n${i % 2000}`,
      character: 'Mara',
      text: `Line ${i} of a scene.`,
      sortOrder: i,
    })),
    cues: Array.from({ length: 10000 }, (_, i) => ({
      id: `q${i}`,
      node: `n${i % 2000}`,
      type: 'audio',
      text: `Cue ${i}`,
      sortOrder: i,
    })),
    connections: Array.from({ length: 10000 }, (_, i) => ({
      id: `k${i}`,
      from: `n${i % 2000}`,
      to: `n${(i + 1 + Math.floor(i / 2000)) % 2000}`,
      label: `Choice ${i}`,
    })),
    media: [],
  }
  const started = Date.now()
  const running = post(await tokenOf(ctx.member), ctx.teamId, JSON.stringify(file))
  const probes: number[] = []
  const writes: number[] = []
  let done = false
  void running.then(() => {
    done = true
  })
  while (!done) {
    const t = Date.now()
    await healthy()
    probes.push(Date.now() - t)
    const w = Date.now()
    const version = Number((await readAsAdmin('nodes', writer)).version)
    expect((await guardedUpdate(ctx.member, 'nodes', writer, { title: `probe ${w}`, version })).status).toBe(200)
    writes.push(Date.now() - w)
    await new Promise((r) => setTimeout(r, 250))
  }
  const reply = await running
  const seconds = (Date.now() - started) / 1000
  console.log(
    `MAX IMPORT: status ${reply.status}, ${seconds.toFixed(1)} s, slowest health call ${Math.max(0, ...probes)} ms, slowest write ${Math.max(0, ...writes)} ms (${probes.length} rounds)`,
  )
  expect(reply.status).toBe(200)
  const admin = await asAdmin()
  const { projectId } = (await reply.json()) as { projectId: string }
  const count = (
    await admin.collection('nodes').getList(1, 1, { filter: admin.filter('project = {:p}', { p: projectId }) })
  ).totalItems
  expect(count).toBe(2000)
})
