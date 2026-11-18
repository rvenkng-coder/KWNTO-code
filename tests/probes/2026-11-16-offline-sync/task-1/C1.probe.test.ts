import { expect, test } from 'vitest'
import { nextDelay, statusText, failedText } from '../../../../frontend/src/features/editor/sync/outboxText'

// Protects: probe of plan row C1, the outbox model rules (design 6.7).
test('[C1] boundary: negative, fractional and huge attempts stay in range', () => {
  expect(nextDelay(-5)).toBe(1000)
  expect(nextDelay(4)).toBe(8000)
  expect(nextDelay(1e6)).toBe(30000)
})

// Protects: probe of plan row C2, the outbox model rules (design 6.7).
test('[C2] boundary: two waiting changes are plural, zero failed is plural', () => {
  expect(statusText(false, 2)).toBe('Offline, 2 changes waiting')
  expect(failedText(0)).toBe('0 changes could not be saved')
})
