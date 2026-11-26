import { createRequire } from 'node:module'
import { describe, expect, test } from 'vitest'

const require = createRequire(import.meta.url)
const { checkLinkUrl } = require('../../backend/pb_hooks/lib/link-check.js')

const NOT_WEB = 'That is not a web address.'
const ONLY_WEB = 'Only http:// and https:// addresses are allowed.'

describe('checkLinkUrl', () => {
  // Protects: good addresses are accepted and only trimmed
  test('web addresses are accepted and trimmed', () => {
    expect(checkLinkUrl('  https://example.com/a?b=1#c ')).toEqual({ ok: true, url: 'https://example.com/a?b=1#c' })
    expect(checkLinkUrl('HTTP://EXAMPLE.COM')).toEqual({ ok: true, url: 'HTTP://EXAMPLE.COM' })
    expect(checkLinkUrl('http://localhost:8090/x')).toEqual({ ok: true, url: 'http://localhost:8090/x' })
  })

  // Protects: nothing that could run script or hide the real host is accepted
  test('unsafe and malformed addresses are refused', () => {
    const scheme = [
      'javascript:alert(1)',
      ' JavaScript:alert(1)',
      'data:text/html,x',
      'ftp://a.b',
      'file:///etc/passwd',
      '//evil.example',
    ]
    for (const text of scheme) {
      expect(checkLinkUrl(text), text).toMatchObject({ ok: false, code: 'link_url_scheme', message: ONLY_WEB })
    }
    const invalid = [
      'https://',
      'https://a b',
      'https://user:pw@host.example',
      'https://google.com@evil.example',
      'example.com',
    ]
    for (const text of invalid) {
      expect(checkLinkUrl(text), text).toMatchObject({ ok: false, code: 'link_url_invalid', message: NOT_WEB })
    }
    for (const text of ['', '   ']) {
      expect(checkLinkUrl(text), text).toMatchObject({
        ok: false,
        code: 'link_url_empty',
        message: 'Enter a web address.',
      })
    }
  })

  // Protects: the length limit is exact
  test('the length limit is 2000', () => {
    const base = 'https://a.example/'
    const at = base + 'x'.repeat(2000 - base.length)
    expect(checkLinkUrl(at).ok).toBe(true)
    expect(checkLinkUrl(at + 'x')).toMatchObject({
      ok: false,
      code: 'link_url_too_long',
      message: 'The address is longer than 2000 characters.',
    })
  })
})
