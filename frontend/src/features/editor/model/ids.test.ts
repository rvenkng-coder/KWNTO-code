import { expect, test } from 'vitest'
import { newId } from './ids'

// Protects: new records get ids PocketBase accepts (15 characters of a-z0-9), never repeated.
test('newId makes 15-character PocketBase ids', () => {
  const seen = new Set<string>()
  for (let i = 0; i < 1000; i++) {
    const id = newId()
    expect(id).toMatch(/^[a-z0-9]{15}$/)
    seen.add(id)
  }
  expect(seen.size).toBe(1000)
  // 255 % 36 = 3, so the all-255 source gives the character '3' fifteen times.
  expect(newId((bytes) => bytes.fill(255))).toBe('333333333333333')
})
