import { afterEach, beforeEach, expect, test, vi } from 'vitest'
import { downloadBlob } from '../../../../frontend/src/features/editor/export/download'

interface Link { href: string; download: string; click: () => void; remove: () => void }
let links: Link[]
let order: string[]

beforeEach(() => {
  vi.useFakeTimers()
  links = []
  order = []
  vi.stubGlobal('document', {
    createElement: () => {
      const link: Link = { href: '', download: '', click: () => order.push('click'), remove: () => order.push('remove') }
      links.push(link)
      return link
    },
    body: { appendChild: () => order.push('append') },
  })
  vi.stubGlobal('URL', { createObjectURL: () => 'blob:one', revokeObjectURL: vi.fn((u: string) => order.push(`revoke ${u}`)) })
})
afterEach(() => {
  vi.useRealTimers()
  vi.unstubAllGlobals()
})

// Protects: the file is saved under exactly the name given, even an awkward one, through one click on a link that is in the page.
test('[C2] case-and-whitespace: the link carries the name and is clicked once, in the page', () => {
  downloadBlob('Story - Chapter 1 é🎭.png', new Blob(['x']))
  expect(links).toHaveLength(1)
  expect(links[0]?.download).toBe('Story - Chapter 1 é🎭.png')
  expect(links[0]?.href).toBe('blob:one')
  expect(order.slice(0, 3)).toEqual(['append', 'click', 'remove'])
})

// Protects: the object URL stays valid long enough for the browser to start the download, then is released once.
test('[C2] race-and-parallel: the URL is revoked after 10 s, not before, and only once', () => {
  downloadBlob('a.png', new Blob(['x']))
  vi.advanceTimersByTime(9_999)
  expect(order.some((o) => o.startsWith('revoke'))).toBe(false)
  vi.advanceTimersByTime(1)
  expect(order.filter((o) => o.startsWith('revoke'))).toEqual(['revoke blob:one'])
  vi.advanceTimersByTime(60_000)
  expect(order.filter((o) => o.startsWith('revoke'))).toHaveLength(1)
})
