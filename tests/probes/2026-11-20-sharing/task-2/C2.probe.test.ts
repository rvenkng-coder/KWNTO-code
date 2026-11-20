import { createRequire } from 'node:module'
import { expect, test } from 'vitest'

const require = createRequire(import.meta.url)
type Result = { ok: true; file: unknown } | { ok: false; problems: string[] }
const { FILE_LIMITS, validateProjectFile } = require('../../../../backend/pb_hooks/lib/project-file.js') as {
  FILE_LIMITS: Record<string, number>
  validateProjectFile: (v: unknown, limits: Record<string, number>) => Result
}
const good = () => ({
  format: 'kwnto-project', version: 1, exportedAt: '2026-11-20 10:00:00.000Z',
  project: { name: 'Story', startNode: 'n1' },
  chapters: [{ id: 'c1', title: 'One', position: 1 }],
  nodes: [{ id: 'n1', chapter: 'c1', title: 'A', color: 'slate', x: 0, y: 0 }],
  lines: [{ id: 'l1', node: 'n1', character: 'X', text: 'hi', sortOrder: 1 }],
  cues: [{ id: 'q1', node: 'n1', type: 'audio', text: 'boom', sortOrder: 1 }],
  connections: [{ id: 'k1', from: 'n1', to: null, label: '' }],
  media: [],
})
const problems = (v: unknown): string[] => {
  const r = validateProjectFile(v, FILE_LIMITS)
  return r.ok ? [] : r.problems
}

// Protects: probe of plan row C2, the one validator (security.md 5 bad imports).
test('[C2] empty-one-huge: a good file passes and nothing else needs to be there', () => {
  expect(validateProjectFile(good(), FILE_LIMITS).ok).toBe(true)
  expect(problems(null).length).toBeGreaterThan(0)
  expect(problems([]).length).toBeGreaterThan(0)
  expect(problems('text').length).toBeGreaterThan(0)
})

// Protects: probe of plan row C2, exact messages.
test('[C2] oracle-leak: header and reference problems use the documented words', () => {
  expect(problems({ ...good(), format: 'other' })[0]).toBe('format must be "kwnto-project"')
  expect(problems({ ...good(), version: 2 })[0]).toBe('version must be 1')
  const badNode = good(); badNode.nodes[0].chapter = 'nope'
  expect(problems(badNode)).toContain('nodes[0].chapter is not a chapter in the file')
  const badTo = good(); badTo.connections[0].to = 'ghost'
  expect(problems(badTo)).toContain('connections[0].to is not a node in the file')
  const dup = good(); dup.nodes.push({ ...dup.nodes[0] })
  expect(problems(dup)).toContain('duplicate id "n1" in nodes')
})

// Protects: probe of plan row C2, limits are exact.
test('[C2] boundary: exactly at a limit passes, one over is refused', () => {
  const atLimit = good(); atLimit.lines[0].text = 'x'.repeat(FILE_LIMITS.text)
  expect(validateProjectFile(atLimit, FILE_LIMITS).ok).toBe(true)
  const over = good(); over.lines[0].text = 'x'.repeat(FILE_LIMITS.text + 1)
  expect(problems(over)).toContain(`lines[0].text is longer than ${FILE_LIMITS.text} characters`)
  const many = good()
  many.nodes = Array.from({ length: FILE_LIMITS.nodes + 1 }, (_, i) => ({ id: `n${i}`, chapter: 'c1', title: 't', color: 'slate', x: 0, y: 0 }))
  many.project.startNode = 'n0'; many.lines = []; many.cues = []; many.connections = []
  expect(problems(many)).toContain(`too many nodes (${FILE_LIMITS.nodes + 1}, at most ${FILE_LIMITS.nodes})`)
})

// Protects: probe of plan row C2, hostile keys.
test('[C2] relative-of-fixed-case: __proto__ and unknown keys are refused, prototypes stay clean', () => {
  const hostile = JSON.parse('{"format":"kwnto-project","version":1,"exportedAt":"x","project":{"name":"S","startNode":null},"chapters":[{"id":"c1","title":"One","position":1}],"nodes":[{"id":"n1","chapter":"c1","title":"A","color":"slate","x":0,"y":0,"__proto__":{"polluted":true}}],"lines":[],"cues":[],"connections":[],"media":[]}')
  expect(problems(hostile)).toContain('unknown key "__proto__" in nodes[0]')
  expect(({} as Record<string, unknown>).polluted).toBeUndefined()
  const extra = good() as Record<string, unknown>; extra.surprise = 1
  expect(problems(extra).join('\n')).toContain('unknown key "surprise"')
  const pink = good(); pink.nodes[0].color = 'pink'
  expect(problems(pink)[0]).toMatch(/^nodes\[0\]\.color must be one of .*slate/)
})

// Protects: probe of plan row C2, many problems are capped and never throw.
test('[C2] two-bad-items: 25 bad lines list 20 problems, first one named, no throw', () => {
  const f = good()
  f.lines = Array.from({ length: 25 }, (_, i) => ({ id: `l${i}`, node: 'ghost', character: 'X', text: 't', sortOrder: i }))
  const p = problems(f)
  expect(p).toHaveLength(20)
  expect(p[0]).toBe('lines[0].node is not a node in the file')
})
