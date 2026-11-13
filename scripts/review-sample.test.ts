import { describe, expect, test } from 'vitest'
import { needsReview, type ReviewInput } from './review-sample.ts'

function input(over: Partial<ReviewInput> = {}): ReviewInput {
  return { changedFiles: ['src/features/a.ts'], taskNumber: 1, builtBy: 'local', escapeRate: 0, ...over }
}

describe('needsReview', () => {
  // Protects the strong-model rule: a strong-built task relies on the plan's own per-task review, even on sensitive paths.
  test('a strong-built task is not sampled', () => {
    const result = needsReview(input({ builtBy: 'strong', taskNumber: 3, changedFiles: ['backend/pb_hooks/x.js'], escapeRate: 1 }))
    expect(result.required).toBe(false)
    expect(result.reason).toBe("built by a strong model; the plan's own per-task review applies")
  })

  // Protects design 6.5: hooks always get a strong review and the reason names the file so the reviewer knows where to look.
  test('a local task touching backend/pb_hooks/x.js is always reviewed and the reason names the file', () => {
    const result = needsReview(input({ changedFiles: ['src/features/a.ts', 'backend/pb_hooks/x.js'] }))
    expect(result.required).toBe(true)
    expect(result.reason).toContain('backend/pb_hooks/x.js')
  })

  // Protects design 6.5: every always-review root is covered, not only hooks.
  test('a local task touching tests/rules/, backend/pb_migrations/, src/backend/ is always reviewed', () => {
    for (const file of ['tests/rules/a.rules.test.ts', 'backend/pb_migrations/1_x.js', 'src/backend/client.ts']) {
      expect(needsReview(input({ changedFiles: [file] })).required, file).toBe(true)
    }
  })

  // Protects design 6.5: sync, conflict and queue logic is the riskiest code, wherever it lives.
  test('a path containing sync, conflict or queue is sensitive', () => {
    for (const file of ['src/features/sync/a.ts', 'src/features/conflict-merge.ts', 'src/features/offlinequeue.ts']) {
      expect(needsReview(input({ changedFiles: [file] })).required, file).toBe(true)
    }
  })

  // Protects the path match: a capitalised folder must not slip past the sensitive list.
  test('case does not matter in that path match (Sync, QUEUE)', () => {
    expect(needsReview(input({ changedFiles: ['src/features/Sync/a.ts'] })).required).toBe(true)
    expect(needsReview(input({ changedFiles: ['src/features/QUEUE.ts'] })).required).toBe(true)
  })

  // Protects the sample rate: 1 in 3 by task number, and only then, for ordinary files.
  test('a local task with only src/features files is reviewed when taskNumber is 3 and 6 and not 1, 2, 4', () => {
    const required = (n: number) => needsReview(input({ taskNumber: n })).required
    expect([3, 6].map(required)).toEqual([true, true])
    expect([1, 2, 4].map(required)).toEqual([false, false, false])
    expect(needsReview(input({ taskNumber: 1 })).reason).toBe('not in the sample (1 in 3)')
  })

  // Protects against a bad task number: 0 and negatives must not crash and must not count as sampled.
  test('taskNumber 0 and negative do not crash and are not sampled', () => {
    for (const n of [0, -3, -1, Number.NaN]) {
      expect(needsReview(input({ taskNumber: n })).required, String(n)).toBe(false)
    }
  })

  // Protects the escape-rate feedback: a high rate reviews every local task.
  test('escapeRate above 0.25 reviews every local task', () => {
    expect(needsReview(input({ taskNumber: 1, escapeRate: 0.26 })).required).toBe(true)
    expect(needsReview(input({ taskNumber: 2, escapeRate: 1 })).required).toBe(true)
  })

  // Protects the threshold boundary: exactly 0.25 is not above it.
  test('escapeRate exactly 0.25 does not', () => {
    expect(needsReview(input({ taskNumber: 1, escapeRate: 0.25 })).required).toBe(false)
  })

  // Protects fail-closed handling of an out-of-range or unreadable rate: it must not silently lower review.
  test('an escapeRate that is NaN or above 1 reviews every local task', () => {
    expect(needsReview(input({ escapeRate: Number.NaN })).required).toBe(true)
    expect(needsReview(input({ escapeRate: 7 })).required).toBe(true)
    expect(needsReview(input({ escapeRate: -1 })).required).toBe(true)
  })

  // Protects the empty case: nothing changed is reported as such, not as a sampling decision.
  test('an empty changedFiles list is handled (reason says nothing changed)', () => {
    const result = needsReview(input({ changedFiles: [], taskNumber: 3 }))
    expect(result.reason).toMatch(/nothing changed/)
    expect(result.required).toBe(true)
  })

  // Protects the path match on Windows checkouts: backslashes must not hide a sensitive folder.
  test('windows-style backslash paths are normalised before matching', () => {
    const result = needsReview(input({ changedFiles: ['backend\\pb_hooks\\x.js'] }))
    expect(result.required).toBe(true)
    expect(result.reason).toContain('backend/pb_hooks/x.js')
  })
})
