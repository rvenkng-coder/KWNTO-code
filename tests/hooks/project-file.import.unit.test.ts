import { createRequire } from 'node:module'
import { expect, test } from 'vitest'

const require = createRequire(import.meta.url)
type Json = Record<string, unknown>
const { FILE_LIMITS, buildProjectFile, validateProjectFile, importPlan } =
  require('../../backend/pb_hooks/lib/project-file.js') as {
    FILE_LIMITS: Record<string, number>
    buildProjectFile: (records: Json, nowIso: string) => Json
    validateProjectFile: (
      value: unknown,
      limits: Record<string, number>,
    ) => { ok: true; file: Json } | { ok: false; problems: string[] }
    importPlan: (file: Json, newId: () => string) => Json
  }

// Protects plan D4, D5 and design 10 (Review Focus 3): an import gives every record a
// fresh id, so ids already in the database can never collide, and every reference (chapter,
// node, from, to, start node) is mapped to the new ids; an empty choice stays empty.
test('an import gives every record a new id and keeps the links', () => {
  const source = buildProjectFile(
    {
      project: { id: 'p1', name: 'Story', start_node: 'n2' },
      chapters: [
        { id: 'c1', title: 'One', position: 1, deleted_at: '' },
        { id: 'c2', title: 'Two', position: 2, deleted_at: '' },
      ],
      nodes: [
        { id: 'n1', chapter: 'c1', title: 'A', color: 'slate', x: 1, y: 2, deleted_at: '' },
        { id: 'n2', chapter: 'c2', title: 'B', color: 'red', x: 3, y: 4, deleted_at: '' },
      ],
      script_lines: [{ id: 'l1', node: 'n2', character: 'X', text: 'hi', sort_order: 1.5 }],
      cues: [{ id: 'q1', node: 'n1', type: 'lighting', text: 'dim', sort_order: 1 }],
      connections: [
        { id: 'k1', from_node: 'n1', to_node: 'n2', label: 'across' },
        { id: 'k2', from_node: 'n2', to_node: '', label: 'open' },
      ],
      media: [],
    },
    '2026-11-20 10:00:00.000Z',
  )
  const checked = validateProjectFile(source, FILE_LIMITS)
  if (!checked.ok) throw new Error(checked.problems.join('; '))

  let counter = 0
  const plan = importPlan(checked.file, () => `n${++counter}x`) as {
    name: string
    startNode: string | null
    chapters: Json[]
    nodes: Json[]
    lines: Json[]
    cues: Json[]
    connections: Json[]
  }

  const text = JSON.stringify(plan)
  for (const oldId of ['"c1"', '"c2"', '"n1"', '"n2"', '"l1"', '"q1"', '"k1"', '"k2"']) {
    expect(text).not.toContain(oldId)
  }
  const all = [...plan.chapters, ...plan.nodes, ...plan.lines, ...plan.cues, ...plan.connections].map((r) => r.id)
  expect(new Set(all).size).toBe(8)
  expect(plan.name).toBe('Story')

  const [chapter1, chapter2] = plan.chapters
  const [nodeA, nodeB] = plan.nodes
  expect(chapter1).toMatchObject({ title: 'One', position: 1 })
  expect(nodeA).toMatchObject({ chapter: chapter1.id, title: 'A', x: 1, y: 2 })
  expect(nodeB).toMatchObject({ chapter: chapter2.id, title: 'B', color: 'red' })
  expect(plan.startNode).toBe(nodeB.id)
  expect(plan.lines[0]).toMatchObject({ node: nodeB.id, text: 'hi', sortOrder: 1.5 })
  expect(plan.cues[0]).toMatchObject({ node: nodeA.id, type: 'lighting' })
  expect(plan.connections[0]).toMatchObject({ from: nodeA.id, to: nodeB.id, label: 'across' })
  expect(plan.connections[1]).toMatchObject({ from: nodeB.id, to: null, label: 'open' })

  // Round trip: what the plan describes exports to a file that validates again.
  const again = buildProjectFile(
    {
      project: { name: plan.name, start_node: plan.startNode },
      chapters: plan.chapters,
      nodes: plan.nodes,
      script_lines: plan.lines.map((l) => ({ ...l, sort_order: l.sortOrder })),
      cues: plan.cues.map((c) => ({ ...c, sort_order: c.sortOrder })),
      connections: plan.connections.map((c) => ({ ...c, from_node: c.from, to_node: c.to ?? '' })),
      media: [],
    },
    '2026-11-20 11:00:00.000Z',
  )
  expect(validateProjectFile(again, FILE_LIMITS).ok).toBe(true)
})
