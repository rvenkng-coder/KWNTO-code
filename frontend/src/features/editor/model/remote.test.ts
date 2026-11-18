import { expect, test } from 'vitest'
import { content, node } from './fixtures'
import { applyRemote } from './remote'
import { fromContent } from './state'

const base = () => fromContent(content({ nodes: [node('a', { title: 'local', version: 5 })] }))

// Protects: only a newer version replaces the local copy (equal means our own echo); unknown ids are added.
test('only newer remote records replace local ones', () => {
  const s = base()
  expect(applyRemote(s, { kind: 'nodes', action: 'update', record: node('a', { title: 'same', version: 5 }) })).toBe(s)
  expect(applyRemote(s, { kind: 'nodes', action: 'update', record: node('a', { title: 'old', version: 4 }) })).toBe(s)
  expect(applyRemote(s, { kind: 'nodes', action: 'update', record: node('a', { title: 'new', version: 6 }) }).nodes.a?.title).toBe('new')
  const created = applyRemote(s, { kind: 'nodes', action: 'create', record: node('b', { version: 0 }) })
  expect(Object.keys(created.nodes).sort()).toEqual(['a', 'b'])
})

// Protects: a delete drops the record; an event of another project changes nothing.
test('deletes apply and other projects are ignored', () => {
  const s = base()
  expect(applyRemote(s, { kind: 'nodes', action: 'delete', record: node('a') }).nodes).toEqual({})
  expect(applyRemote(s, { kind: 'nodes', action: 'update', record: node('a', { projectId: 'other', version: 9 }) })).toBe(s)
})

// Protects: the project record itself is updated from an event with its own id.
test('a newer project record replaces the open project', () => {
  const s = base()
  const next = applyRemote(s, { kind: 'projects', action: 'update', record: { ...s.project!, name: 'Renamed', version: 1 } })
  expect(next.project?.name).toBe('Renamed')
  const other = applyRemote(s, { kind: 'projects', action: 'update', record: { ...s.project!, id: 'p2', name: 'X', version: 1 } })
  expect(other).toBe(s)
})
