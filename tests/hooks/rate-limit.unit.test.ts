import { createRequire } from 'node:module'
import { expect, test } from 'vitest'

// The guess limit on join codes and invites (design 5, docs/security.md section 3;
// the setting `team_attempts_per_hour`, default 20). A join code is about 40 bits, so
// it is guessable in principle; this decision is what keeps guessing slow. The hooks
// choose which attempts belong to the caller and pass their times (teams-join.pb.js,
// and teams-invites.pb.js).

const require = createRequire(import.meta.url)
const { isOverLimit } = require('../../backend/pb_hooks/lib/rate-limit.js') as {
  isOverLimit: (timesMs: number[], nowMs: number, windowMs: number, max: number) => boolean
}

const NOW = 1_000_000_000_000
const HOUR = 3_600_000

// n attempt times spread inside the last hour (1 to n minutes ago).
function recentTimes(n: number): number[] {
  return Array.from({ length: n }, (_, i) => NOW - (i + 1) * 60_000)
}

// Protects the normal case: a user with no attempts is never refused.
test('no attempts: not over the limit', () => {
  expect(isOverLimit([], NOW, HOUR, 20)).toBe(false)
})

// Protects the setting's meaning: 20 per hour allows the 20th attempt.
test('19 attempts in the window with a limit of 20: not over', () => {
  expect(isOverLimit(recentTimes(19), NOW, HOUR, 20)).toBe(false)
})

// Protects the limit itself: after 20 attempts within the hour, the next is refused.
test('20 attempts in the window with a limit of 20: over', () => {
  expect(isOverLimit(recentTimes(20), NOW, HOUR, 20)).toBe(true)
})

// Protects "per hour": an attempt older than the window no longer counts, so the limit
// ends by itself.
test('20 attempts of which one is older than the window: not over', () => {
  const times = recentTimes(19)
  times.push(NOW - HOUR - 1)
  expect(isOverLimit(times, NOW, HOUR, 20)).toBe(false)
})

// Protects small settings: a limit of 1 refuses the second attempt within the hour.
test('a limit of 1 with one attempt in the window: over', () => {
  expect(isOverLimit([NOW - 1_000], NOW, HOUR, 1)).toBe(true)
})

// Protects the documented meaning of 0 (docs/admin/settings.md): no attempts at all,
// so the admin can pause joining and inviting. Unlike the lockout settings, 0 is not
// "off": an off switch here would remove the only brake on code guessing.
test('a limit of 0 refuses every attempt', () => {
  expect(isOverLimit([], NOW, HOUR, 0)).toBe(true)
})
