import { describe, expect, test } from 'vitest'
import { content, cue, line, node } from '../model/fixtures'
import { fromContent } from '../model/state'
import { classifyConflict, overlay, planAdd, type NewEntry, type OutboxEntry } from './outbox'

const base = { userId: 'u1', projectId: 'p1', offline: false, made: 1 }
const upd = (
  seq: number,
  id: string,
  changes: Record<string, unknown>,
  baseValues: Record<string, unknown>,
  over: Partial<OutboxEntry> = {},
): OutboxEntry =>
  ({
    ...base,
    seq,
    op: 'update',
    kind: 'nodes',
    id,
    changes,
    baseVersion: 3,
    baseValues,
    snapshot: null,
    ...over,
  }) as OutboxEntry
const newUpd = (
  id: string,
  changes: Record<string, unknown>,
  baseValues: Record<string, unknown>,
  over: Partial<NewEntry> = {},
): NewEntry =>
  ({
    ...base,
    op: 'update',
    kind: 'nodes',
    id,
    changes,
    baseVersion: 4,
    baseValues,
    snapshot: null,
    ...over,
  }) as NewEntry

describe('planAdd', () => {
  // Protects: an edit joins the last waiting edit of the same record, never one being sent or one behind another
  // record's edit.
  test('an edit joins the last waiting edit of the same record only', () => {
    const queue = [upd(1, 'n1', { title: 'B' }, { title: 'A' })]
    const plan = planAdd(queue, newUpd('n1', { title: 'C', color: 'red' }, { title: 'B', color: 'slate' }), null)
    expect(plan.append).toBeNull()
    expect(plan.replace).toMatchObject({
      seq: 1,
      changes: { title: 'C', color: 'red' },
      baseValues: { title: 'A', color: 'slate' },
      baseVersion: 3,
    })
    const sending = planAdd(queue, newUpd('n1', { title: 'C' }, { title: 'B' }), 1)
    expect(sending.replace).toBeNull()
    expect(sending.append).not.toBeNull()
    const between = planAdd(
      [...queue, upd(2, 'n2', { title: 'X' }, { title: 'Y' })],
      newUpd('n1', { title: 'C' }, { title: 'B' }),
      null,
    )
    expect(between.replace).toBeNull()
    expect(between.append).not.toBeNull()
  })

  const create = (seq: number): OutboxEntry => ({
    ...base,
    seq,
    op: 'create',
    kind: 'script_lines',
    id: 'L',
    record: line('L'),
  })
  const lineUpd = (seq: number): OutboxEntry => upd(seq, 'L', { text: 'x' }, { text: 'L' }, { kind: 'script_lines' })
  const remove: NewEntry = { ...base, op: 'remove', kind: 'script_lines', id: 'L', record: line('L') }

  // Protects: a remove cancels waiting work on that record but never a request already on the wire.
  test('removing a record cancels its waiting edits but never one being sent', () => {
    const both = planAdd([create(1), lineUpd(2)], remove, null)
    expect(both.drop.sort()).toEqual([1, 2])
    expect(both.append).toBeNull()
    const sending = planAdd([lineUpd(1), lineUpd(2)], remove, 1)
    expect(sending.drop).toEqual([2])
    expect(sending.append).toEqual(remove)
  })
})

describe('overlay', () => {
  // Protects: waiting edits are laid over fresh server data, not under it.
  test('waiting edits are laid over fresh server data', () => {
    const server = fromContent(
      content({
        nodes: [node('n1', { title: 'Theirs', color: 'red', version: 7 })],
        lines: [line('K', { text: 'server K' }), line('M')],
      }),
    )
    const queue: OutboxEntry[] = [
      upd(1, 'n1', { color: 'blue' }, { color: 'red' }),
      { ...base, seq: 2, op: 'create', kind: 'script_lines', id: 'L', record: line('L') },
      { ...base, seq: 3, op: 'create', kind: 'script_lines', id: 'K', record: line('K', { text: 'mine K' }) },
      { ...base, seq: 4, op: 'remove', kind: 'script_lines', id: 'M', record: line('M') },
      upd(5, 'n9', { color: 'blue' }, { color: 'red' }, { projectId: 'other' }),
    ]
    const out = overlay(server, queue)
    expect(out.nodes.n1).toMatchObject({ title: 'Theirs', color: 'blue', version: 7 })
    expect(out.lines.L).toBeDefined()
    expect(out.lines.K?.text).toBe('server K')
    expect(out.lines.M).toBeUndefined()
    expect(out.nodes.n9).toBeUndefined()
  })
})

describe('classifyConflict', () => {
  const offlineUpd = (
    changes: Record<string, unknown>,
    baseValues: Record<string, unknown>,
    over: Partial<OutboxEntry> = {},
  ) => upd(1, 'n1', changes, baseValues, { offline: true, ...over })

  // Protects: only a change by someone else to the same attribute is a conflict.
  test('only a change by someone else to the same attribute is a conflict', () => {
    const e = offlineUpd({ title: 'B' }, { title: 'A' })
    expect(classifyConflict(e, node('n1', { title: 'C' }))).toEqual({ type: 'fields', fields: ['title'] })
    expect(classifyConflict(e, node('n1', { title: 'B' }))).toEqual({ type: 'none' })
    expect(classifyConflict(e, node('n1', { title: 'A' }))).toEqual({ type: 'none' })
    const color = offlineUpd({ title: 'B' }, { title: 'A' })
    expect(classifyConflict(color, node('n1', { title: 'A', color: 'red' }))).toEqual({ type: 'none' })
    const pos = offlineUpd({ x: 5, y: 6 }, { x: 0, y: 0 })
    expect(classifyConflict(pos, node('n1', { x: 9, y: 0 }))).toEqual({ type: 'fields', fields: ['x', 'y'] })
    expect(classifyConflict(e, null)).toEqual({ type: 'deleted' })
    expect(classifyConflict({ ...e, offline: false }, node('n1', { title: 'C' }))).toEqual({ type: 'none' })
  })

  // Protects: a record removed while someone else edited it is a conflict; a create never is.
  test('a removed record edited by someone else is a conflict', () => {
    const rm: OutboxEntry = {
      ...base,
      seq: 1,
      offline: true,
      op: 'remove',
      kind: 'cues',
      id: 'q',
      record: cue('q', { text: 'mine' }),
    }
    expect(classifyConflict(rm, cue('q', { text: 'theirs' }))).toEqual({ type: 'fields', fields: ['text'] })
    expect(classifyConflict(rm, null)).toEqual({ type: 'none' })
    expect(classifyConflict(rm, cue('q', { text: 'mine', version: 5 }))).toEqual({ type: 'none' })
    const cr: OutboxEntry = { ...base, seq: 2, offline: true, op: 'create', kind: 'cues', id: 'q', record: cue('q') }
    expect(classifyConflict(cr, cue('q'))).toEqual({ type: 'none' })
  })
})
