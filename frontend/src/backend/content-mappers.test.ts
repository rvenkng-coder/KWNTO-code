// Protects decision 0002 (save per attribute: "the client sends only the fields it
// changed") and the rule that screens never see a PocketBase record: content records map
// to editor types and back, an update body carries only the changed keys, and a create
// body keeps the client-made id but never the version the guard owns.
import { expect, test } from 'vitest'
import { fromRecord, toCreateBody, toUpdateBody } from './content-mappers'

// Protects: screens get editor types (trash flag from deleted_at, defaults for missing text), never a raw record.
test('records map to editor types', () => {
  const node = fromRecord('nodes', {
    id: 'n1',
    project: 'p1',
    chapter: 'c1',
    title: 'Gate',
    color: 'blue',
    x: 10,
    y: 20,
    deleted_at: '2026-11-16 09:00:00.000Z',
    version: 2,
    created: 'x',
    updated: 'y',
  })
  expect(node).toEqual({
    id: 'n1',
    projectId: 'p1',
    chapterId: 'c1',
    title: 'Gate',
    color: 'blue',
    x: 10,
    y: 20,
    width: 0,
    height: 0,
    coverMediaId: '',
    deleted: true,
    deletedAt: '2026-11-16T09:00:00.000Z',
    version: 2,
  })

  const line = fromRecord('script_lines', {
    id: 'l1',
    project: 'p1',
    node: 'n1',
    text: 'Hello',
    sort_order: 1.5,
    version: 0,
  })
  expect(line).toEqual({
    id: 'l1',
    projectId: 'p1',
    nodeId: 'n1',
    character: '',
    text: 'Hello',
    sortOrder: 1.5,
    version: 0,
  })
})

// Protects: save per attribute: only the changed keys are sent, so a teammate's other fields are never overwritten.
test('update bodies carry only the changed fields', () => {
  expect(toUpdateBody('nodes', { x: 5 })).toEqual({ x: 5 })

  const trashed = toUpdateBody('nodes', { deleted: true })
  expect(Object.keys(trashed)).toEqual(['deleted_at'])
  expect(new Date(String(trashed.deleted_at)).toISOString()).toBe(trashed.deleted_at)

  expect(toUpdateBody('nodes', { deleted: false })).toEqual({ deleted_at: '' })
  expect(toUpdateBody('projects', { startNodeId: null })).toEqual({ start_node: '' })
})

// Protects: undo and offline creates rely on the client id; the create rule refuses a body with `version`.
test('create bodies keep the client id and drop the version', () => {
  const body = toCreateBody('connections', {
    id: 'k1',
    projectId: 'p1',
    fromNodeId: 'a',
    toNodeId: 'b',
    label: 'Yes',
    created: '2026-11-18T10:00:00.000Z',
    version: 3,
  })
  expect(body).toEqual({ id: 'k1', project: 'p1', from_node: 'a', to_node: 'b', label: 'Yes' })
  expect('version' in body).toBe(false)
})

// Protects: an empty choice reads as no target (editor cards design, goal 1), and the stored time is turned into ISO
// text, so it sorts as text next to a time made in the browser.
test('an empty to_node reads as null and created is ISO', () => {
  const choice = fromRecord('connections', {
    id: 'k1',
    project: 'p1',
    from_node: 'a',
    to_node: '',
    label: 'Wait',
    created: '2026-11-18 10:00:00.000Z',
    version: 0,
  })
  expect(choice).toEqual({
    id: 'k1',
    projectId: 'p1',
    fromNodeId: 'a',
    toNodeId: null,
    label: 'Wait',
    created: '2026-11-18T10:00:00.000Z',
    version: 0,
  })
})

// Protects: editor cards design 1: unlinking sends an empty relation, and the server owns `created`.
test('a choice is created and unlinked with an empty to_node', () => {
  const body = toCreateBody('connections', {
    id: 'k1',
    projectId: 'p1',
    fromNodeId: 'a',
    toNodeId: null,
    label: '',
    created: '2026-11-18T10:00:00.000Z',
    version: 0,
  })
  expect(body).toEqual({ id: 'k1', project: 'p1', from_node: 'a', to_node: '', label: '' })
  expect(toUpdateBody('connections', { toNodeId: null })).toEqual({ to_node: '' })
})

// Protects: a node's own size is read and sent as an update, and a node saved before sizes existed reads as 0 (the default).
test('a node size is mapped and can be updated', () => {
  const sized = fromRecord('nodes', {
    id: 'n2',
    project: 'p1',
    chapter: 'c1',
    title: '',
    color: 'blue',
    x: 0,
    y: 0,
    width: 300,
    height: 180,
    version: 1,
  }) as { width: number; height: number }
  expect([sized.width, sized.height]).toEqual([300, 180])
  expect(toUpdateBody('nodes', { width: 320, height: 200 })).toEqual({ width: 320, height: 200 })
})
