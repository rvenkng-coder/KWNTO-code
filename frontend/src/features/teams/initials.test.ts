import { expect, test } from 'vitest'
import { initials } from './initials'

// Protects: an avatar shows one or two capitals for a name, and a question mark for no name.
test('initials of a name', () => {
  expect(initials('Mara Lin')).toBe('ML')
  expect(initials('mara')).toBe('M')
  expect(initials('  Ana  Maria  Lopez ')).toBe('AL')
  expect(initials('')).toBe('?')
})
