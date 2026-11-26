import { createRequire } from 'node:module'
import { expect, test } from 'vitest'

// The team join code (design section 5: a join code lets a whole class join quickly): 8 characters
// from an alphabet without look-alike characters (no 0/O, no 1/I), so a code read off a projector
// is typed right. The randomness is passed in, so these tests control it; the hook passes a
// crypto-quality source.

const require = createRequire(import.meta.url)
const { generateJoinCode, JOIN_CODE_ALPHABET } = require('../../backend/pb_hooks/lib/join-code.js') as {
  generateJoinCode: (randomIndex: (n: number) => number) => string
  JOIN_CODE_ALPHABET: string
}

// Protects the mapping from random index to character: index 0 is the first letter.
test('with randomIndex always 0 the code is AAAAAAAA', () => {
  expect(generateJoinCode(() => 0)).toBe('AAAAAAAA')
})

// Protects the other end of the mapping: the last index is the last character, 9.
test('with randomIndex always n - 1 the code is 99999999', () => {
  expect(generateJoinCode((n) => n - 1)).toBe('99999999')
})

// Protects the code format over many codes: the length is always 8 and every character is in the
// alphabet. A small seeded generator keeps the run repeatable.
test('1,000 codes all have 8 characters from the alphabet', () => {
  let seed = 12345
  const pseudoRandom = (n: number): number => {
    seed = (seed * 1103515245 + 12345) % 2147483648
    return seed % n
  }
  const allowed = new Set(JOIN_CODE_ALPHABET)
  for (let i = 0; i < 1000; i++) {
    const code = generateJoinCode(pseudoRandom)
    expect(code).toHaveLength(8)
    for (const character of code) {
      expect(allowed.has(character)).toBe(true)
    }
  }
})

// Protects the alphabet: 32 distinct characters, none of them a look-alike.
test('the alphabet has 32 distinct characters and no 0, O, 1 or I', () => {
  expect(JOIN_CODE_ALPHABET).toBe('ABCDEFGHJKLMNPQRSTUVWXYZ23456789')
  expect(new Set(JOIN_CODE_ALPHABET).size).toBe(32)
  for (const lookAlike of ['0', 'O', '1', 'I']) {
    expect(JOIN_CODE_ALPHABET).not.toContain(lookAlike)
  }
})

// Protects even use of the alphabet: each character is drawn from all 32, never from
// a shorter range that would make some characters impossible.
test('randomIndex is asked for a number below 32, once per character', () => {
  const calls: number[] = []
  generateJoinCode((n) => {
    calls.push(n)
    return 0
  })
  expect(calls).toEqual([32, 32, 32, 32, 32, 32, 32, 32])
})
