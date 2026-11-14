import { expect, test } from 'vitest'
import { guard } from './helpers'

// Protects: the table name used in SQL is only ever one of the seven content collections.
test('[C1] case-and-whitespace: near-miss names are refused', () => {
  for (const name of ['Nodes', 'nodes ', ' nodes', 'NODES', 'node', 'nodes\n', 'nodés', '']) {
    expect(() => guard.guardedTable(name)).toThrow(`not a guarded collection: ${name}`)
  }
})

// Protects: every one of the seven is accepted and returned unchanged.
test('[C1] empty-one-huge: all seven content collections are accepted', () => {
  const seven = ['projects', 'project_settings', 'chapters', 'nodes', 'script_lines', 'cues', 'connections']
  expect([...guard.GUARDED].sort()).toEqual([...seven].sort())
  for (const name of seven) expect(guard.guardedTable(name)).toBe(name)
})

// Protects: other existing collections are not guarded.
test('[C1] wrong-actor: other collections are refused', () => {
  for (const name of ['teams', 'team_settings', 'team_members', '_superusers', 'users', 'spike_nodes']) {
    expect(() => guard.guardedTable(name)).toThrow()
  }
})
