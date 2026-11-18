import { createRequire } from 'node:module'
import { describe, expect, test } from 'vitest'

const require = createRequire(import.meta.url)
const { extensionType, quotaFor, formatBytes } = require('../../backend/pb_hooks/lib/media-check.js') as {
  extensionType: (fileName: string) => string | null
  quotaFor: (defaultBytes: number, overrideBytes: number) => number
  formatBytes: (bytes: number) => string
}

describe('media-check names, quota and sizes', () => {
  // Protects: a file name's extension gives its claimed type
  test('a file name\'s extension gives its claimed type', () => {
    expect(extensionType('a.JPG ')).toBe('jpeg')
    expect(extensionType('x.jpeg')).toBe('jpeg')
    expect(extensionType('song.Mp3')).toBe('mp3')
    expect(extensionType('clip.mov')).toBe('mov')
    expect(extensionType('noext')).toBeNull()
    expect(extensionType('evil.png.html')).toBeNull()
    expect(extensionType('.wav')).toBe('wav')
    expect(extensionType('a.gif')).toBeNull()
  })

  // Protects: the quota uses the override and sizes read well
  test('the quota uses the override and sizes read well', () => {
    expect(quotaFor(2147483648, 0)).toBe(2147483648)
    expect(quotaFor(2147483648, 5000)).toBe(5000)

    expect(formatBytes(0)).toBe('0 KB')
    expect(formatBytes(12000)).toBe('12 KB')
    expect(formatBytes(1048575)).toBe('1024 KB')
    expect(formatBytes(1048576)).toBe('1.0 MB')
    expect(formatBytes(209715200)).toBe('200.0 MB')
    expect(formatBytes(1610612736)).toBe('1.5 GB')
  })
})
