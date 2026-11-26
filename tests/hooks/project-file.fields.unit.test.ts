import { createRequire } from 'node:module'
import { expect, test } from 'vitest'

const require = createRequire(import.meta.url)
type Json = Record<string, unknown>
const { FILE_LIMITS, buildProjectFile, validateProjectFile, importPlan } = require('../../backend/pb_hooks/lib/project-file.js') as {
  FILE_LIMITS: Record<string, number>
  buildProjectFile: (records: Json, nowIso: string) => Json
  validateProjectFile: (value: unknown, limits: Record<string, number>) => { ok: true; file: Json } | { ok: false; problems: string[] }
  importPlan: (file: Json, newId: () => string) => { nodes: Json[]; links: Json[] }
}

const NOW = '2026-11-26 10:00:00.000Z'
const node = (id: string, extra: Json = {}) => ({
  id, chapter: 'c1', title: id, color: 'slate', x: 0, y: 0, width: 0, height: 0, cover_media: '', deleted_at: '', ...extra,
})
const link = (id: string, nodeId: string, created: string, url = 'https://example.com/a') => ({ id, node: nodeId, title: id, url, created })
const image = (id: string, nodeId: string, extra: Json = {}) => ({ id, node: nodeId, title: id, kind: 'image', removed_at: '', ...extra })

function records(extra: Json): Json {
  return {
    project: { id: 'p1', name: 'Story', start_node: '' },
    chapters: [{ id: 'c1', title: 'One', position: 1, deleted_at: '' }],
    nodes: [node('n1')], script_lines: [], cues: [], connections: [], media: [], node_links: [],
    ...extra,
  }
}

// Protects design 10 and the sharing views: a node's own size, cover and links are in the file;
// a default size, a cover that is not a live image of that node, a link of a trashed node and an
// address that is not a web address are left out.
test('the file holds a node\'s size, cover and links', () => {
  const file = buildProjectFile(
    records({
      nodes: [
        node('n1', { width: 320, height: 240, cover_media: 'm1' }),
        node('n2', { cover_media: 'm2' }),
        node('n3', { cover_media: 'm1' }),
        node('n4', { cover_media: 'm3' }),
        node('n5', { deleted_at: NOW }),
      ],
      media: [image('m1', 'n1'), image('m2', 'n2', { removed_at: NOW }), image('m3', 'n4', { kind: 'audio' })],
      node_links: [
        link('k2', 'n1', '2026-11-26 09:00:02.000Z'),
        link('k1', 'n1', '2026-11-26 09:00:01.000Z'),
        link('k3', 'n5', '2026-11-26 09:00:00.000Z'),
        link('k4', 'n1', '2026-11-26 09:00:03.000Z', 'javascript:alert(1)'),
      ],
    }),
    NOW,
  )
  const [n1, ...others] = file.nodes as Json[]
  expect(n1).toEqual({ id: 'n1', chapter: 'c1', title: 'n1', color: 'slate', x: 0, y: 0, width: 320, height: 240, cover: 'm1' })
  for (const other of others) expect(Object.keys(other)).toEqual(['id', 'chapter', 'title', 'color', 'x', 'y'])
  expect(file.links).toEqual([
    { id: 'k1', node: 'n1', title: 'k1', url: 'https://example.com/a' },
    { id: 'k2', node: 'n1', title: 'k2', url: 'https://example.com/a' },
  ])
  const checked = validateProjectFile(file, FILE_LIMITS)
  expect(checked.ok && checked.file).toEqual(file)
})

function goodFile(): Json {
  return buildProjectFile(
    records({ nodes: [node('n1', { width: 320, height: 240, cover_media: 'm1' })], media: [image('m1', 'n1')], node_links: [link('k1', 'n1', NOW)] }),
    NOW,
  )
}

function firstProblem(change: (file: { nodes: Json[]; links: Json[] }) => void): string | undefined {
  const file = goodFile() as Json & { nodes: Json[]; links: Json[] }
  change(file)
  const result = validateProjectFile(file, FILE_LIMITS)
  return result.ok ? undefined : result.problems[0]
}

// Protects security.md 5 "Bad imports" for the newer parts of a file: a size outside what a node
// stores, a cover or link pointing nowhere, an address that is not a web address and an unknown
// key are each refused by name.
test('bad sizes, covers and links are refused', () => {
  expect(firstProblem(() => {})).toBeUndefined()
  expect(firstProblem((f) => { f.nodes[0]!.width = 2001 })).toBe('nodes[0].width must be between 0 and 2000')
  expect(firstProblem((f) => { f.nodes[0]!.height = -1 })).toBe('nodes[0].height must be between 0 and 2000')
  expect(firstProblem((f) => { f.nodes[0]!.width = '320' })).toBe('nodes[0].width must be a number')
  expect(firstProblem((f) => { f.nodes[0]!.cover = 'm9' })).toBe('nodes[0].cover is not a media entry in the file')
  expect(firstProblem((f) => { f.links[0]!.node = 'n9' })).toBe('links[0].node is not a node in the file')
  expect(firstProblem((f) => { f.links[0]!.url = 'javascript:alert(1)' })).toBe('links[0].url is not a web address')
  expect(firstProblem((f) => { delete f.links[0]!.url })).toBe('links[0].url is missing')
  expect(firstProblem((f) => { f.links[0]!.title = 'x'.repeat(121) })).toBe('links[0].title is longer than 120 characters')
  expect(firstProblem((f) => { f.links[0]!.creator = 'u1' })).toBe('unknown key "creator" in links[0]')
})

// Protects design 10: an import keeps a node's size, gives each link a new id on the new node,
// and drops the cover, whose image is not in the file.
test('an import plan keeps sizes and links and drops the cover', () => {
  const checked = validateProjectFile(goodFile(), FILE_LIMITS)
  if (!checked.ok) throw new Error(checked.problems.join('; '))
  let counter = 0
  const plan = importPlan(checked.file, () => `new${++counter}`)
  expect(plan.nodes[0]).toMatchObject({ width: 320, height: 240 })
  expect(plan.nodes[0]).not.toHaveProperty('cover')
  expect(plan.links).toEqual([{ id: expect.stringMatching(/^new/), node: plan.nodes[0]!.id, title: 'k1', url: 'https://example.com/a' }])
})
