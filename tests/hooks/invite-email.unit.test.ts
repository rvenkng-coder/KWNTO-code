import { createRequire } from 'node:module'
import { describe, expect, test } from 'vitest'

// Protects design 5 (invite by email) and the plan's privacy rule for the security
// log: the invite route looks accounts up by the email as typed but trimmed and
// lower-cased, and logs only the part after the "@", never the address itself.

const require = createRequire(import.meta.url)
const { normalisedEmail, emailDomain } = require('../../backend/pb_hooks/lib/invite-email.js') as {
  normalisedEmail: (value: unknown) => string
  emailDomain: (email: string) => string
}

describe('normalisedEmail', () => {
  // Typed by hand: stray spaces and capitals must not hide an account.
  test('trims and lower-cases a typed address', () => {
    expect(normalisedEmail('  Ivy.Invitee@Example.TEST \n')).toBe('ivy.invitee@example.test')
  })

  // A missing or malformed body must not crash the route; it matches no account.
  test('anything that is not a string becomes the empty string', () => {
    for (const value of [undefined, null, 42, { email: 'a@b.c' }, ['a@b.c']]) {
      expect(normalisedEmail(value)).toBe('')
    }
  })
})

describe('emailDomain', () => {
  // The log keeps the domain so the admin can spot a sweep of one organisation's
  // addresses, without the log becoming a list of registered emails.
  test('is the part after the last "@"', () => {
    expect(emailDomain('ivy@example.test')).toBe('example.test')
    expect(emailDomain('"odd@local"@example.test')).toBe('example.test')
  })

  // Without an "@" there is no domain; returning the input would log whatever was
  // typed, which may be an address with a typo.
  test('is empty when there is no "@" or nothing after it', () => {
    expect(emailDomain('ivy.example.test')).toBe('')
    expect(emailDomain('ivy@')).toBe('')
    expect(emailDomain('')).toBe('')
  })
})

const { chooseAccountIndex } = require('../../backend/pb_hooks/lib/invite-email.js') as {
  chooseAccountIndex: (storedEmails: string[], typed: string) => number
}

// Review fix (Task 8): accounts may differ only in letter case, so the lookup can match
// two. The exact address typed wins; one match is used whatever its case; two matches
// and no exact one is refused (-1), never a guess.
describe('chooseAccountIndex', () => {
  test('picks the stored address equal to the one typed, wherever it is', () => {
    expect(chooseAccountIndex(['Dup@Example.test', 'dup@example.test'], 'dup@example.test')).toBe(1)
    expect(chooseAccountIndex(['dup@example.test', 'Dup@Example.test'], 'Dup@Example.test')).toBe(1)
  })

  test('picks the only match whatever its case', () => {
    expect(chooseAccountIndex(['Ivy@Example.TEST'], 'ivy@example.test')).toBe(0)
  })

  test('refuses two matches with no exact one, and no match at all', () => {
    expect(chooseAccountIndex(['Dup@Example.test', 'dup@example.test'], 'DUP@EXAMPLE.TEST')).toBe(-1)
    expect(chooseAccountIndex([], 'ivy@example.test')).toBe(-1)
  })
})
