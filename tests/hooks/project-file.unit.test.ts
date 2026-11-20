import { createRequire } from 'node:module'
import { expect, test } from 'vitest'

// The hook helpers are CommonJS so PocketBase can require() them; load them the same way.
const require = createRequire(import.meta.url)
type Json = Record<string, unknown>
const { FILE_LIMITS, buildProjectFile, validateProjectFile, downloadName, importedName, utf8Length } = require('../../backend/pb_hooks/lib/project-file.js') as {
  downloadName: (name: string) => string
  importedName: (name: string) => string
  utf8Length: (text: string) => number
  FILE_LIMITS: Record<string, number>
  buildProjectFile: (records: Json, nowIso: string) => Json
  validateProjectFile: (value: unknown, limits: Record<string, number>) => { ok: true; file: Json } | { ok: false; problems: string[] }
}

const NOW = '2026-11-20 10:00:00.000Z'
const TRASHED = '2026-11-19 10:00:00.000Z'

// Protects design 10 and plan D5: the file holds only what is live (trashed records, the
// nodes of a trashed chapter and removed media stay out), in a stable order, and a choice
// whose target is gone keeps its text with `to: null`.
test('the file holds only what is live, in order', () => {
  const file = buildProjectFile(
    {
      project: { id: 'p1', name: 'My story', start_node: 'n1' },
      chapters: [
        { id: 'c2', title: 'Two', position: 2, deleted_at: TRASHED },
        { id: 'c1', title: 'One', position: 1, deleted_at: '' },
      ],
      nodes: [
        { id: 'n3', chapter: 'c2', title: 'In trashed chapter', color: 'red', x: 3, y: 3, deleted_at: '' },
        { id: 'n2', chapter: 'c1', title: 'Trashed', color: 'blue', x: 2, y: 2, deleted_at: TRASHED },
        { id: 'n1', chapter: 'c1', title: 'Start', color: 'slate', x: 1, y: 1, deleted_at: '' },
        { id: 'n4', chapter: 'c1', title: 'Other', color: 'green', x: 4, y: 4, deleted_at: '' },
      ],
      script_lines: [
        { id: 'l2', node: 'n1', character: 'B', text: 'second', sort_order: 2 },
        { id: 'l1', node: 'n1', character: 'A', text: 'first', sort_order: 1 },
        { id: 'l3', node: 'n3', character: 'C', text: 'in trashed chapter', sort_order: 1 },
      ],
      cues: [{ id: 'q1', node: 'n1', type: 'audio', text: 'bang', sort_order: 1 }],
      connections: [
        { id: 'k2', from_node: 'n1', to_node: 'n2', label: 'to the trashed node' },
        { id: 'k1', from_node: 'n1', to_node: 'n4', label: 'to other' },
        { id: 'k3', from_node: 'n4', to_node: '', label: '' },
      ],
      media: [
        { id: 'm1', node: 'n1', title: 'Theme', kind: 'audio', removed_at: '' },
        { id: 'm2', node: 'n1', title: 'Gone', kind: 'image', removed_at: TRASHED },
      ],
    },
    NOW,
  )

  expect(file.format).toBe('kwnto-project')
  expect(file.version).toBe(1)
  expect(file.exportedAt).toBe(NOW)
  expect(file.project).toEqual({ name: 'My story', startNode: 'n1' })
  expect(file.chapters).toEqual([{ id: 'c1', title: 'One', position: 1 }])
  expect(file.nodes).toEqual([
    { id: 'n1', chapter: 'c1', title: 'Start', color: 'slate', x: 1, y: 1 },
    { id: 'n4', chapter: 'c1', title: 'Other', color: 'green', x: 4, y: 4 },
  ])
  expect(file.lines).toEqual([
    { id: 'l1', node: 'n1', character: 'A', text: 'first', sortOrder: 1 },
    { id: 'l2', node: 'n1', character: 'B', text: 'second', sortOrder: 2 },
  ])
  expect(file.cues).toEqual([{ id: 'q1', node: 'n1', type: 'audio', text: 'bang', sortOrder: 1 }])
  expect(file.connections).toEqual([
    { id: 'k1', from: 'n1', to: 'n4', label: 'to other' },
    { id: 'k2', from: 'n1', to: null, label: 'to the trashed node' },
    { id: 'k3', from: 'n4', to: null, label: '' },
  ])
  expect(file.media).toEqual([{ id: 'm1', node: 'n1', title: 'Theme', kind: 'audio' }])
  expect(validateProjectFile(file, FILE_LIMITS).ok).toBe(true)
})

// A small valid file as plain JSON, so each case below breaks exactly one thing.
function goodFile(): Json {
  return {
    format: 'kwnto-project',
    version: 1,
    exportedAt: NOW,
    project: { name: 'P', startNode: 'n1' },
    chapters: [{ id: 'c1', title: 'One', position: 1 }],
    nodes: [{ id: 'n1', chapter: 'c1', title: 'A', color: 'slate', x: 0, y: 0 }],
    lines: [{ id: 'l1', node: 'n1', character: 'X', text: 'hi', sortOrder: 1 }],
    cues: [],
    connections: [{ id: 'k1', from: 'n1', to: 'n1', label: '' }],
    media: [],
  }
}

function problemsOf(value: unknown): string[] {
  const result = validateProjectFile(value, FILE_LIMITS)
  if (result.ok) throw new Error('expected the file to be refused')
  return result.problems
}

function edited(change: (file: Json) => void): Json {
  const file = goodFile()
  change(file)
  return file
}

// Protects security.md 5 "Bad imports" and design 8b: a file is untrusted input. Each bad
// shape is refused with the documented message, the first problem is the one shown, a flood
// of problems stops at 20, and a `__proto__` key made by JSON.parse is refused without
// touching Object.prototype.
test('an untrusted file is refused with the first problem named', () => {
  expect(validateProjectFile(goodFile(), FILE_LIMITS).ok).toBe(true)

  expect(problemsOf(null)[0]).toBe('it is not JSON')
  expect(problemsOf([])[0]).toBe('it is not JSON')
  expect(problemsOf(edited((f) => { f.format = 'other' }))[0]).toBe('format must be "kwnto-project"')
  expect(problemsOf(edited((f) => { f.version = 2 }))[0]).toBe('version must be 1')
  expect(problemsOf(edited((f) => { (f.nodes as Json[])[0].chapter = 'c9' }))[0]).toBe('nodes[0].chapter is not a chapter in the file')
  expect(problemsOf(edited((f) => { (f.connections as Json[])[0].to = 'n9' }))[0]).toBe('connections[0].to is not a node in the file')
  expect(problemsOf(edited((f) => { (f.connections as Json[])[0].from = 'n9' }))[0]).toBe('connections[0].from is not a node in the file')
  expect(problemsOf(edited((f) => { (f.lines as Json[])[0].node = 'n9' }))[0]).toBe('lines[0].node is not a node in the file')
  expect(problemsOf(edited((f) => { (f.project as Json).startNode = 'n9' }))[0]).toBe('project.startNode is not a node in the file')
  expect(problemsOf(edited((f) => { delete (f.project as Json).name }))[0]).toBe('project.name is missing')
  expect(problemsOf(edited((f) => { (f.nodes as Json[])[0].x = '3' }))[0]).toBe('nodes[0].x must be a number')
  expect(problemsOf(edited((f) => { (f.nodes as Json[])[0].title = 7 }))[0]).toBe('nodes[0].title must be a string')
  expect(problemsOf(edited((f) => { delete f.nodes }))[0]).toBe('nodes is missing')

  const longText = 'x'.repeat(FILE_LIMITS.text + 1)
  expect(problemsOf(edited((f) => { (f.lines as Json[])[0].text = longText }))[0]).toBe(
    `lines[0].text is longer than ${FILE_LIMITS.text} characters`,
  )
  expect(problemsOf(edited((f) => { (f.nodes as Json[])[0].color = 'pink' }))[0]).toBe(
    'nodes[0].color must be one of slate, red, orange, amber, green, teal, blue, purple',
  )
  expect(problemsOf(edited((f) => { (f.cues as Json[]).push({ id: 'q1', node: 'n1', type: 'smell', text: '', sortOrder: 1 }) }))[0]).toBe(
    'cues[0].type must be one of audio, lighting, other',
  )

  const twin = { id: 'n1', chapter: 'c1', title: 'B', color: 'red', x: 1, y: 1 }
  expect(problemsOf(edited((f) => { (f.nodes as Json[]).push(twin) }))[0]).toBe('duplicate id "n1" in nodes')

  const crowded = edited((f) => {
    f.nodes = Array.from({ length: FILE_LIMITS.nodes + 1 }, (_, i) => ({ id: `n${i}`, chapter: 'c1', title: '', color: 'slate', x: 0, y: 0 }))
    f.lines = []
    f.connections = []
    ;(f.project as Json).startNode = null
  })
  expect(problemsOf(crowded)[0]).toBe(`too many nodes (${FILE_LIMITS.nodes + 1}, at most ${FILE_LIMITS.nodes})`)

  const hostile = JSON.parse(
    '{"format":"kwnto-project","version":1,"exportedAt":"x","project":{"name":"P","startNode":null},' +
      '"chapters":[{"id":"c1","title":"One","position":1}],' +
      '"nodes":[{"id":"n1","chapter":"c1","title":"A","color":"slate","x":0,"y":0,"__proto__":{"polluted":true}}],' +
      '"lines":[],"cues":[],"connections":[],"media":[]}',
  )
  expect(problemsOf(hostile)[0]).toBe('unknown key "__proto__" in nodes[0]')
  expect(problemsOf(edited((f) => { f.extra = 1 }))[0]).toBe('unknown key "extra" in the file')
  expect(({} as Json).polluted).toBeUndefined()
  expect(Object.keys(Object.prototype)).toEqual([])

  const manyBad = edited((f) => {
    f.lines = Array.from({ length: 25 }, (_, i) => ({ id: `l${i}`, node: 'n9', character: '', text: '', sortOrder: i }))
  })
  const problems = problemsOf(manyBad)
  expect(problems[0]).toBe('lines[0].node is not a node in the file')
  expect(problems).toHaveLength(20)
})

// Protects the validator's promise to never throw and to hand back fresh objects: odd
// values (a string, a number, a deeply wrong shape) come back as problems, and a good
// file's result shares nothing with the input.
test('the validator never throws and returns a copy', () => {
  for (const value of [undefined, 3, 'text', true, { format: 'kwnto-project', version: 1, project: 5, chapters: 'x' }]) {
    expect(() => validateProjectFile(value, FILE_LIMITS)).not.toThrow()
    expect(validateProjectFile(value, FILE_LIMITS).ok).toBe(false)
  }
  const input = goodFile()
  const result = validateProjectFile(input, FILE_LIMITS)
  if (!result.ok) throw new Error('expected ok')
  expect(result.file).toEqual(input)
  expect(result.file).not.toBe(input)
  expect((result.file.nodes as Json[])[0]).not.toBe((input.nodes as Json[])[0])
})

// Protects the route's small decisions (design 10): the download name keeps letters, digits,
// - and _ only (no header injection, no path), the imported project's name always fits the
// 120-character field, and the size check counts bytes, not characters.
test('names and sizes the routes rely on', () => {
  expect(downloadName('My story')).toBe('My-story.kwnto.json')
  expect(downloadName('a"; b\r\nX: y/../z')).toBe('a-b-X-y-z.kwnto.json')
  expect(downloadName('***')).toBe('project.kwnto.json')
  expect(downloadName('é')).toBe('project.kwnto.json')
  expect(downloadName('x'.repeat(300)).length).toBeLessThanOrEqual(100)

  expect(importedName('Story')).toBe('Story (imported)')
  const long = importedName('y'.repeat(FILE_LIMITS.name))
  expect(Array.from(long)).toHaveLength(FILE_LIMITS.name)
  expect(long.endsWith(' (imported)')).toBe(true)

  expect(utf8Length('abc')).toBe(3)
  expect(utf8Length('é')).toBe(2)
  expect(utf8Length('€')).toBe(3)
  expect(utf8Length('😀')).toBe(4)
})

// Protects the messages shown to a person: an unknown key is echoed cut to 50 characters, so
// a hostile file cannot fill the alert with its own text.
test('an unknown key is echoed cut to 50 characters', () => {
  const key = 'k'.repeat(200)
  const problems = problemsOf(edited((f) => { (f.nodes as Json[])[0][key] = 1 }))
  expect(problems[0]).toBe(`unknown key "${'k'.repeat(50)}" in nodes[0]`)
})

// Protects the limits (design 10): the media list is metadata only but still bounded, at
// 2,000 entries, with the same message as the other lists.
test('too many media entries are refused', () => {
  expect(FILE_LIMITS.media).toBe(2000)
  const media = Array.from({ length: FILE_LIMITS.media + 1 }, (_, i) => ({ id: `m${i}`, node: 'n1', title: '', kind: 'audio' }))
  expect(problemsOf(edited((f) => { f.media = media }))[0]).toBe(`too many media (${FILE_LIMITS.media + 1}, at most ${FILE_LIMITS.media})`)
  const ok = Array.from({ length: FILE_LIMITS.media }, (_, i) => ({ id: `m${i}`, node: 'n1', title: '', kind: 'audio' }))
  expect(validateProjectFile(edited((f) => { f.media = ok }), FILE_LIMITS).ok).toBe(true)
})
