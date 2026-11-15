import { expect, test } from 'vitest'
import { toUpdateBody } from '../../../../frontend/src/backend/content-mappers'

// Protects: two changed keys are both sent, with their snake_case names.
test('[C2] two-bad-items: two changed fields are both sent', () => {
  expect(toUpdateBody('script_lines', { character: 'Ann', sortOrder: 2.5 })).toEqual({ character: 'Ann', sort_order: 2.5 })
})

// Protects: an empty change sends nothing at all.
test('[C2] empty-one-huge: no changes give an empty body', () => {
  expect(toUpdateBody('nodes', {})).toEqual({})
  expect(toUpdateBody('connections', {})).toEqual({})
})

// Protects: falsy values are still sent (0, '' and false are real changes).
test('[C2] helper-hides-bug: zero, empty text and false are sent', () => {
  expect(toUpdateBody('nodes', { x: 0, title: '' })).toEqual({ x: 0, title: '' })
  expect(toUpdateBody('project_settings', { analyticsEnabled: false })).toEqual({ analytics_enabled: false })
})

// Protects: a set start node is sent as its id; trashing a chapter sets a time.
test('[C2] second-bad-item: start node id and chapter trash', () => {
  expect(toUpdateBody('projects', { startNodeId: 'n1' })).toEqual({ start_node: 'n1' })
  const body = toUpdateBody('chapters', { title: 'T', deleted: true })
  expect(body.title).toBe('T')
  expect(Number.isNaN(Date.parse(String(body.deleted_at)))).toBe(false)
  expect(Object.keys(body).sort()).toEqual(['deleted_at', 'title'])
})

// Protects: restoring clears the time; `version` is never put in the body by the mapper.
test('[C2] stale-after-change: restore clears deleted_at and no version is added', () => {
  const body = toUpdateBody('projects', { deleted: false })
  expect(body).toEqual({ deleted_at: '' })
})
