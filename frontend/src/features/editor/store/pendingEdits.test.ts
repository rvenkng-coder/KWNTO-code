import { expect, test } from 'vitest'
import { createPendingEdits, shouldWarnOnLeave, TEXT_SAVE_DELAY_MS } from './pendingEdits'

// A timer the test fires by hand: `fire()` runs every timer still scheduled.
function fakeTimers() {
  let next = 0
  const timers = new Map<number, { fn: () => void; ms: number }>()
  const schedule = (fn: () => void, ms: number) => {
    next++
    timers.set(next, { fn, ms })
    return next
  }
  const cancel = (handle: unknown) => void timers.delete(handle as number)
  const fire = () => {
    const due = [...timers.entries()]
    timers.clear()
    for (const [, t] of due) t.fn()
  }
  return { schedule, cancel, fire, timers }
}

// Protects: typing again in the same field restarts the wait and only the newest text is saved, once.
test('a newer edit of the same field replaces the pending one', () => {
  const t = fakeTimers()
  const pending = createPendingEdits(t.schedule, t.cancel)
  const ran: string[] = []
  pending.set('nodes:n1:title', () => ran.push('a'))
  pending.set('nodes:n1:title', () => ran.push('b'))
  expect([...t.timers.values()].map((x) => x.ms)).toEqual([TEXT_SAVE_DELAY_MS])
  t.fire()
  expect(ran).toEqual(['b'])
  expect(pending.size()).toBe(0)
})

// Protects: leaving saves every field still waiting, each once, and the timers do not save them again.
test('flushAll saves every pending edit once', () => {
  const t = fakeTimers()
  const pending = createPendingEdits(t.schedule, t.cancel)
  const ran: string[] = []
  pending.set('nodes:n1:title', () => ran.push('a'))
  pending.set('script_lines:l1:text', () => ran.push('b'))
  expect(pending.size()).toBe(2)
  pending.flushAll()
  expect(ran).toEqual(['a', 'b'])
  expect(pending.size()).toBe(0)
  t.fire()
  pending.flushAll()
  pending.flush('nodes:n1:title')
  expect(ran).toEqual(['a', 'b'])
})

// Protects: flushing one field saves that field only.
test('flush saves one pending field and leaves the others waiting', () => {
  const t = fakeTimers()
  const pending = createPendingEdits(t.schedule, t.cancel)
  const ran: string[] = []
  pending.set('k1', () => ran.push('a'))
  pending.set('k2', () => ran.push('b'))
  pending.flush('k1')
  expect(ran).toEqual(['a'])
  expect(pending.size()).toBe(1)
  t.fire()
  expect(ran).toEqual(['a', 'b'])
})

// Protects: the leave warning shows while text waits or a save is in flight, and not otherwise.
test('leaving warns while anything is unsaved', () => {
  expect(shouldWarnOnLeave(0, 0)).toBe(false)
  expect(shouldWarnOnLeave(1, 0)).toBe(true)
  expect(shouldWarnOnLeave(0, 2)).toBe(true)
})
