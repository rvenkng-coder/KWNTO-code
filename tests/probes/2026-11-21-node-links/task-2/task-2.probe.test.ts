import { createRequire } from 'node:module'
import { expect, test } from 'vitest'

const require = createRequire(import.meta.url)
const { checkLinkUrl } = require('../../../../backend/pb_hooks/lib/link-check.js')

// Probes use inputs the task's own tests do not. Written by the author after the code (native
// execution): weaker than sealed probes; the final whole-branch review covers the gap.

// Protects: unusual but valid web addresses are accepted.
test('[C1] boundary-inputs: ports, IPv6 hosts, query-only and fragment-only paths are accepted', () => {
  for (const text of ['http://[::1]:8080/x', 'https://a.example?x=1', 'https://a.example#top', 'https://a.example:443', 'https://sub.a-b.example/p%20q']) {
    expect(checkLinkUrl(text), text).toMatchObject({ ok: true })
  }
})

// Protects: whitespace tricks and scheme tricks never produce an accepted address.
test('[C2] error-paths: tabs, newlines, mixed case scripts and empty hosts are refused', () => {
  for (const text of ['https://a.example/\nb', 'https://a\t.example', 'jAvAsCrIpT:alert(1)', '\njavascript:alert(1)', 'http:///path', 'https:\\\\a.example', 'vbscript:x', 'blob:https://a.example/x']) {
    expect(checkLinkUrl(text), JSON.stringify(text)).toMatchObject({ ok: false })
  }
})

// Protects: non-string input never throws and is refused as empty.
test('[C3] error-paths: null, undefined and numbers are refused without throwing', () => {
  expect(checkLinkUrl(null)).toMatchObject({ ok: false, code: 'link_url_empty' })
  expect(checkLinkUrl(undefined)).toMatchObject({ ok: false, code: 'link_url_empty' })
  expect(checkLinkUrl(42)).toMatchObject({ ok: false })
})
