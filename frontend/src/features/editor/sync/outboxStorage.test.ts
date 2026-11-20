import { expect, test } from 'vitest'
import { node } from '../model/fixtures'
import type { NewEntry } from './outbox'
import { createMemoryOutbox } from './outboxStorage'

const entry = (userId: string, id: string): NewEntry =>
  ({ userId, projectId: 'p1', op: 'create', kind: 'nodes', id, record: node(id), offline: false, made: 1 })

// Protects: engineering 9 "never discard a queued edit": order by seq, seqs never reused, a failed entry moves instead of vanishing.
test('the memory outbox keeps order and moves failed entries', async () => {
  const box = createMemoryOutbox()
  const seqs = [await box.add(entry('u1', 'a')), await box.add(entry('u1', 'b')), await box.add(entry('u1', 'c'))]
  expect(seqs).toEqual([1, 2, 3])
  const all = await box.list('u1')
  await box.put({ ...all[0]!, offline: true })
  const { fail } = box
  await fail(all[1]!, 'nope')
  await box.remove([1])
  expect((await box.list('u1')).map((e) => e.seq)).toEqual([3])
  expect(await box.add(entry('u1', 'd'))).toBe(4)
  expect((await box.list('u1')).map((e) => e.seq)).toEqual([3, 4])
  expect((await box.failed('u1')).map((f) => [f.entry.seq, f.message])).toEqual([[2, 'nope']])
  await box.dismiss(2)
  expect(await box.failed('u1')).toEqual([])
  await box.add(entry('u2', 'z'))
  expect((await box.list('u1')).map((e) => e.seq)).toEqual([3, 4])
})
