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
