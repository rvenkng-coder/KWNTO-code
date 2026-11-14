import { createRequire } from 'node:module'
import { expect, test } from 'vitest'

// Protects design 7c and docs/security.md section 3: a password has at least 10
// characters, a letter and a number, and is not one of the very common passwords.
// The same function guards sign-up, password change and password reset in PocketBase,
// so a gap here is a gap on every path that sets a password.

// The hook helpers are CommonJS so PocketBase can require() them; load them the same way.
const require = createRequire(import.meta.url)
const { checkPassword } = require('../../backend/pb_hooks/lib/password-rules.js') as {
  checkPassword: (password: string) => string | null
}
const COMMON = require('../../backend/pb_hooks/lib/common-passwords.js') as string[]

function expectRefused(password: string): void {
  const message = checkPassword(password)
  expect(typeof message, `"${password}" was accepted`).toBe('string')
  expect(message).not.toBe('')
}

test('10 characters is enough; 9 is not', () => {
  expect(checkPassword('abcdefghi1')).toBeNull()
  expectRefused('abcdefgh1')
})

test('a password needs a letter and a number', () => {
  expectRefused('abcdefghijk')
  expectRefused('12345678901')
})

test('very common passwords are refused, whatever their case', () => {
  expectRefused('Password123')
  expectRefused('PASSWORD123')
  expectRefused('qwertyuiop1')
})

test('a long password passes and an empty one does not', () => {
  expect(checkPassword(`${'a'.repeat(99)}1`)).toBeNull()
  expectRefused('')
})

// Users write in more than one language; a letter is any letter, not only a-z.
test('non-ASCII letters count as letters', () => {
  expect(checkPassword('contraseña12')).toBeNull()
})

// Passphrases are encouraged, so spaces inside are fine.
test('whitespace is allowed inside a password', () => {
  expect(checkPassword('correct horse 1 battery')).toBeNull()
})

test('each rule has its own user-facing message', () => {
  expect(checkPassword('abc1')).toBe('Use at least 10 characters.')
  expect(checkPassword('abcdefghijk')).toBe('Include at least one number.')
  expect(checkPassword('12345678901')).toBe('Include at least one letter.')
  expect(checkPassword('password123')).toBe('That password is too common.')
})

// The common list only earns its place with entries the other rules let through:
// a shorter or letter-only entry could never be reached, and an upper-case one would
// never match the lower-cased comparison.
test('every common-password entry is lower case, unique and would otherwise pass', () => {
  expect(COMMON.length).toBeGreaterThanOrEqual(180)
  expect(new Set(COMMON).size).toBe(COMMON.length)
  for (const entry of COMMON) {
    expect(entry, entry).toBe(entry.toLowerCase())
    expect(Array.from(entry).length, entry).toBeGreaterThanOrEqual(10)
    expect(entry, entry).toMatch(/\p{L}/u)
    expect(entry, entry).toMatch(/\p{N}/u)
  }
})
