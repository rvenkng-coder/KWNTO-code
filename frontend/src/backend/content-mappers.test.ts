// Protects decision 0002 (save per attribute: "the client sends only the fields it
// changed") and the rule that screens never see a PocketBase record: content records map
// to editor types and back, an update body carries only the changed keys, and a create
// body keeps the client-made id but never the version the guard owns.
import { expect, test } from 'vitest'
import { fromRecord, toCreateBody, toUpdateBody } from './content-mappers'

test('records map to editor types', () => {
  const node = fromRecord('nodes', {
    id: 'n1', project: 'p1', chapter: 'c1', title: 'Gate', color: 'blue', x: 10, y: 20,
    deleted_at: '2026-11-16 09:00:00.000Z', version: 2, created: 'x', updated: 'y',
  })
  expect(node).toEqual({ id: 'n1', projectId: 'p1', chapterId: 'c1', title: 'Gate', color: 'blue', x: 10, y: 20, deleted: true, version: 2 })

  const line = fromRecord('script_lines', { id: 'l1', project: 'p1', node: 'n1', text: 'Hello', sort_order: 1.5, version: 0 })
  expect(line).toEqual({ id: 'l1', projectId: 'p1', nodeId: 'n1', character: '', text: 'Hello', sortOrder: 1.5, version: 0 })
})

test('update bodies carry only the changed fields', () => {
  expect(toUpdateBody('nodes', { x: 5 })).toEqual({ x: 5 })

  const trashed = toUpdateBody('nodes', { deleted: true })
  expect(Object.keys(trashed)).toEqual(['deleted_at'])
  expect(new Date(String(trashed.deleted_at)).toISOString()).toBe(trashed.deleted_at)

  expect(toUpdateBody('nodes', { deleted: false })).toEqual({ deleted_at: '' })
  expect(toUpdateBody('projects', { startNodeId: null })).toEqual({ start_node: '' })
})

test('create bodies keep the client id and drop the version', () => {
  const body = toCreateBody('connections', { id: 'k1', projectId: 'p1', fromNodeId: 'a', toNodeId: 'b', label: 'Yes', version: 3 })
  expect(body).toEqual({ id: 'k1', project: 'p1', from_node: 'a', to_node: 'b', label: 'Yes' })
  expect('version' in body).toBe(false)
})
