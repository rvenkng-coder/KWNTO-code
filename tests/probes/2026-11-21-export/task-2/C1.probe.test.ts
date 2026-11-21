import { expect, test } from 'vitest'
import { dataUrlBytes } from '../../../../frontend/src/features/editor/export/documents'
import { PNG } from './helpers'

// Protects: other things that merely look like data URLs are refused too.
test('[C1] case-and-whitespace: empty, parameter-only and non-base64 inputs are refused', () => {
  for (const bad of ['', 'data:', 'data:image/png;charset=utf-8,abc', 'image/png;base64,AAAA', 'blob:http://x/1', '  ' + PNG.slice(0, 20)]) {
    expect(() => dataUrlBytes(bad)).toThrow('Not a data URL')
  }
})

// Protects: the decoded bytes are the whole image, not a prefix.
test('[C1] empty-one-huge: the whole PNG comes back, ending in IEND', () => {
  const b = dataUrlBytes(PNG)
  expect(b.length).toBe(Math.floor((PNG.split(',')[1]!.length * 3) / 4) - 2)
  expect(new TextDecoder('latin1').decode(b.slice(-8, -4))).toBe('IEND')
})
