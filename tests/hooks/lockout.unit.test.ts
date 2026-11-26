import { createRequire } from 'node:module'
import { expect, test } from 'vitest'

// The lockout decision (design 7c: after 3 failed sign-ins, "try again after 5 minutes";
// both numbers are admin settings). It also protects the rule that a lockout ends by
// itself: it is computed from the failure times alone, so time passing unlocks it, and
// retryAfterSeconds tells the person exactly when.
//
// The input is the failures of ONE account from ONE IP (decision D2). Choosing which
// failures belong to the pair is the hook's job (users-signin.pb.js); the rule tests
// all come from 127.0.0.1, so the per-IP split is only visible here: a list that holds
// only this pair's failures decides for this pair alone.

const require = createRequire(import.meta.url)
type Decision = { locked: boolean; retryAfterSeconds: number }
const { decideLockout } = require('../../backend/pb_hooks/lib/lockout.js') as {
  decideLockout: (failureTimesMs: number[], nowMs: number, maxFailed: number, lockoutMinutes: number) => Decision
}

const NOW = 1_000_000_000_000
const MINUTE = 60_000

function minutesAgo(minutes: number): number {
  return NOW - minutes * MINUTE
}

// Protects the normal case: nobody is locked out before failing.
test('no failures: not locked', () => {
  expect(decideLockout([], NOW, 3, 5)).toEqual({ locked: false, retryAfterSeconds: 0 })
})

// Protects design 7c: fewer failures than the limit do not lock.
test('two failures in the window with a limit of 3: not locked', () => {
  expect(decideLockout([minutesAgo(1), minutesAgo(2)], NOW, 3, 5)).toEqual({ locked: false, retryAfterSeconds: 0 })
})

// Protects design 7c: the third failure within 5 minutes locks, and the lockout ends
// when the oldest of those three is 5 minutes old (here in 60 seconds).
test('three failures in the last 5 minutes lock until the oldest leaves the window', () => {
  expect(decideLockout([minutesAgo(4), minutesAgo(2), minutesAgo(1)], NOW, 3, 5)).toEqual({
    locked: true,
    retryAfterSeconds: 60,
  })
})

// Protects "the lockout ends by itself": a failure older than the window no longer counts.
test('three failures, the oldest 6 minutes ago, leave only two in the window: not locked', () => {
  expect(decideLockout([minutesAgo(6), minutesAgo(2), minutesAgo(1)], NOW, 3, 5)).toEqual({
    locked: false,
    retryAfterSeconds: 0,
  })
})

// Protects the length of the lockout: it lasts until fewer than the limit remain in the
// window, which is when the 3rd most recent failure leaves it, not the oldest.
test('with five failures and a limit of 3, the wait counts from the 3rd most recent', () => {
  const failures = [minutesAgo(4.5), minutesAgo(4), minutesAgo(3), minutesAgo(2), minutesAgo(1)]
  expect(decideLockout(failures, NOW, 3, 5)).toEqual({ locked: true, retryAfterSeconds: 120 })
})

// Protects the hook's freedom to pass rows in any order (the database sort is not relied on).
test('the order of the failure times does not matter', () => {
  const failures = [minutesAgo(1), minutesAgo(4.5), minutesAgo(3), minutesAgo(4), minutesAgo(2)]
  expect(decideLockout(failures, NOW, 3, 5)).toEqual({ locked: true, retryAfterSeconds: 120 })
})

// Protects the settings: max_failed_logins 1 locks after a single failure.
test('a limit of 1 locks after one failure', () => {
  expect(decideLockout([minutesAgo(0.5)], NOW, 1, 5)).toEqual({ locked: true, retryAfterSeconds: 270 })
})

// Protects the settings: lockout_minutes 1 gives a 60-second window.
test('one lockout minute is a 60-second window', () => {
  expect(decideLockout([NOW - 50_000, NOW - 40_000, NOW - 10_000], NOW, 3, 1)).toEqual({
    locked: true,
    retryAfterSeconds: 10,
  })
  expect(decideLockout([NOW - 61_000, NOW - 40_000, NOW - 10_000], NOW, 3, 1)).toEqual({
    locked: false,
    retryAfterSeconds: 0,
  })
})

// Protects the rounding promised in the interface: a part second counts as a whole one,
// so the person is never told to retry before the lockout has ended.
test('retryAfterSeconds rounds up to whole seconds', () => {
  expect(decideLockout([NOW - 299_500, NOW - 1_000, NOW - 500], NOW, 3, 5)).toEqual({
    locked: true,
    retryAfterSeconds: 1,
  })
})

// Protects the admin from locking everyone out by mistake: the settings allow 0, and 0
// for either number turns the lockout off instead of refusing every first attempt.
test('a limit or a window of 0 turns the lockout off', () => {
  const failures = [minutesAgo(1), minutesAgo(2), minutesAgo(3)]
  expect(decideLockout(failures, NOW, 0, 5)).toEqual({ locked: false, retryAfterSeconds: 0 })
  expect(decideLockout(failures, NOW, 3, 0)).toEqual({ locked: false, retryAfterSeconds: 0 })
})
