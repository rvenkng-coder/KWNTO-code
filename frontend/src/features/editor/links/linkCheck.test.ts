import { describe, expect, test } from 'vitest'
import { checkLinkUrl, linkHost, linkLabel, safeHref } from './linkCheck.ts'

const NOT_WEB = 'That is not a web address.'
const ONLY_WEB = 'Only http:// and https:// addresses are allowed.'

describe('checkLinkUrl', () => {
  // Protects: good addresses pass and are only trimmed (C1)
  test('web addresses pass and are trimmed', () => {
    expect(checkLinkUrl('  https://example.com/a ')).toEqual({ ok: true, url: 'https://example.com/a' })
    expect(checkLinkUrl('HTTP://EXAMPLE.COM')).toEqual({ ok: true, url: 'HTTP://EXAMPLE.COM' })
  })

  // Protects: nothing unsafe passes, with the same words as the server (C2)
  test('unsafe addresses are refused', () => {
    for (const text of ['javascript:alert(1)', ' JavaScript:alert(1)', 'data:text/html,x', 'ftp://a.b', 'file:///etc/passwd', '//evil.example']) {
      expect(checkLinkUrl(text), text).toEqual({ ok: false, message: ONLY_WEB })
    }
    for (const text of ['https://', 'https://a b', 'https://user:pw@host.example', 'https://google.com@evil.example', 'example.com']) {
      expect(checkLinkUrl(text), text).toEqual({ ok: false, message: NOT_WEB })
    }
    for (const text of ['', '   ']) {
      expect(checkLinkUrl(text), text).toEqual({ ok: false, message: 'Enter a web address.' })
    }
    const base = 'https://a.example/'
    expect(checkLinkUrl(base + 'x'.repeat(2000 - base.length)).ok).toBe(true)
    expect(checkLinkUrl(base + 'x'.repeat(2001 - base.length))).toEqual({ ok: false, message: 'The address is longer than 2000 characters.' })
  })
})

describe('linkHost and linkLabel', () => {
  // Protects: the host shown beside a link, and the label when there is no title (C3)
  test('the host and the label', () => {
    expect(linkHost('https://Example.COM:8080/a?b#c')).toBe('example.com:8080')
    expect(linkLabel({ title: '  ', url: 'https://x.example/p' })).toBe('x.example')
    expect(linkLabel({ title: 'Trailer', url: 'https://x.example/p' })).toBe('Trailer')
  })
})

describe('safeHref', () => {
  // Protects: whatever is stored (an admin edit, a restored backup), only a web address becomes a clickable href (final review, Important 1)
  test('only a web address becomes a link target', () => {
    expect(safeHref('https://example.com/a')).toBe('https://example.com/a')
    for (const stored of ['javascript:alert(1)', 'data:text/html,x', 'vbscript:x', 'ftp://a.b', '', 'not a link']) {
      expect(safeHref(stored), stored).toBeNull()
    }
  })
})
