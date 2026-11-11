// Protects: the unit-test runner itself. If this fails, no other unit result can be trusted.
import { expect, test } from 'vitest'
test('vitest runs TypeScript', () => {
  const total: number = [1, 2, 3].reduce((sum, n) => sum + n, 0)
  expect(total).toBe(6)
})
