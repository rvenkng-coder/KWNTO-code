import { expect, test } from 'vitest'
import { ago } from './ago'

const NOW = Date.parse('2026-11-21T12:00:00Z')

// Protects: the project card says when the project was last edited in plain words, and shows nothing for a missing date.
test('ago puts a date in plain words', () => {
  expect(ago('2026-11-21 11:59:40.000Z', NOW)).toBe('just now')
  expect(ago('2026-11-21 11:59:00.000Z', NOW)).toBe('1 minute ago')
  expect(ago('2026-11-21 09:00:00.000Z', NOW)).toBe('3 hours ago')
  expect(ago('2026-11-19T12:00:00Z', NOW)).toBe('2 days ago')
  expect(ago('2026-08-01T12:00:00Z', NOW)).toBe('3 months ago')
  expect(ago('2024-01-01T00:00:00Z', NOW)).toBe('2 years ago')
  expect(ago('', NOW)).toBe('')
  expect(ago(undefined, NOW)).toBe('')
  expect(ago('not a date', NOW)).toBe('')
})
