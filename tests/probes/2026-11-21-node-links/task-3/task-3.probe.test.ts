import { expect, test } from 'vitest'
import { checkLinkUrl, linkHost, linkLabel } from '../../../../frontend/src/features/editor/links/linkCheck.ts'

// Written by the author after the code (native execution): weaker than sealed probes; the final
// whole-branch review covers the gap.

// Protects: unusual valid addresses pass on the client as on the server.
test('[C1] boundary-inputs: ports, IPv6 hosts and bare query paths pass', () => {
  for (const text of ['http://[::1]:8080/x', 'https://a.example?x=1', 'https://a.example#top', 'https://sub.a-b.example/p%20q']) {
    expect(checkLinkUrl(text), text).toMatchObject({ ok: true })
  }
})

// Protects: whitespace and scheme tricks never pass the client check.
test('[C2] error-paths: tabs, newlines, mixed-case scripts and empty hosts are refused', () => {
  for (const text of ['https://a.example/\nb', 'https://a\t.example', 'jAvAsCrIpT:alert(1)', '\njavascript:alert(1)', 'http:///path', 'vbscript:x', 'blob:https://a.example/x']) {
    expect(checkLinkUrl(text), JSON.stringify(text)).toMatchObject({ ok: false })
  }
})

// Protects: display helpers cope with odd stored values.
test('[C3] boundary-inputs: host of a non-address is empty and the label falls back to it', () => {
  expect(linkHost('not a link')).toBe('')
  expect(linkLabel({ title: '', url: 'https://X.example' })).toBe('x.example')
  expect(linkLabel({ title: ' Spaced ', url: 'https://x.example' })).toBe('Spaced')
})
