import { createRequire } from 'node:module'
import { expect, test } from 'vitest'

const require = createRequire(import.meta.url)
const {
  extensionType,
  quotaFor,
  formatBytes,
  detectType,
  checkUpload,
  usedThrough,
  MIB,
} = require('../../../../backend/pb_hooks/lib/media-check.js')

function stringToBytes(str: string): number[] {
  return Array.from(Buffer.from(str, 'ascii'))
}

// Protects: magic bytes variations.
test('[C1] boundary-inputs: each allowed media type is detected from variations', () => {
  expect(detectType([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0, 0])).toBe('png')
  expect(detectType([0xff, 0xd8, 0xff, 0xdb, 0, 0])).toBe('jpeg')
  expect(detectType([...stringToBytes('RIFF'), 100, 0, 0, 0, ...stringToBytes('WAVE'), 1, 2, 3, 4])).toBe('wav')
  expect(detectType([...stringToBytes('ID3'), 4, 0, 0, 0, 0, 0, 0])).toBe('mp3')
  expect(detectType([0xff, 0xf2, 0, 0])).toBe('mp3')
  expect(detectType([0, 0, 0, 20, ...stringToBytes('ftyp'), ...stringToBytes('qt  '), 0, 0])).toBe('mov')
  expect(detectType([0, 0, 0, 24, ...stringToBytes('ftyp'), ...stringToBytes('avc1'), 0, 0])).toBe('mp4')
  expect(detectType([0, 0, 0, 8, ...stringToBytes('mdat'), 0, 0])).toBe('mov')
})

// Protects: non-media inputs.
test('[C2] empty-one-huge: non-media bytes return null', () => {
  expect(detectType([0])).toBeNull()
  expect(detectType([0xff])).toBeNull()
  expect(detectType(stringToBytes('GIF87a'))).toBeNull()
  expect(detectType(stringToBytes('BM'))).toBeNull()
  expect(detectType(new Array(32).fill(0xaa))).toBeNull()
})

// Protects: name variations.
test('[C3] case-and-whitespace: extension parsing handles whitespace and casing', () => {
  expect(extensionType('test.WAV')).toBe('wav')
  expect(extensionType('  track.MP3  ')).toBe('mp3')
  expect(extensionType('video.MOV')).toBe('mov')
  expect(extensionType('file.MP4')).toBe('mp4')
  expect(extensionType('image.JPEG')).toBe('jpeg')
  expect(extensionType('photo.JPG')).toBe('jpeg')
  expect(extensionType('doc.pdf')).toBeNull()
  expect(extensionType('')).toBeNull()
})

// Protects: quota calculations and byte formatting.
test('[C4] numeric-extremes: quota override and boundary formatBytes', () => {
  expect(quotaFor(1000, -5)).toBe(1000)
  expect(quotaFor(1000, 2000)).toBe(2000)
  expect(formatBytes(-1)).toBe('0 KB')
  expect(formatBytes(1)).toBe('1 KB')
  expect(formatBytes(1024)).toBe('1 KB')
  expect(formatBytes(1025)).toBe('2 KB')
  expect(formatBytes(1048576 * 1024)).toBe('1.0 GB')
})

// Protects: mismatched byte refusal.
test('[C5] invalid-combination: disguised files are caught', () => {
  const wavHead = [...stringToBytes('RIFF'), 0, 0, 0, 0, ...stringToBytes('WAVE'), 0, 0, 0, 0]
  const res = checkUpload({
    fileName: 'track.mp3',
    size: 100,
    head: wavHead,
    allowedTypes: ['wav', 'mp3'],
    maxMb: { audio: 10, video: 10, image: 10 },
    usedBytes: 0,
    quotaBytes: 100000,
  })
  expect(res.ok).toBe(false)
  if (!res.ok) {
    expect(res.code).toBe('media_not_real')
    expect(res.message).toBe('This file is not a real MP3 file.')
  }
})

// Protects: disallowed types refusal.
test('[C6] missing-field: unallowed extension or detected type', () => {
  const res = checkUpload({
    fileName: 'movie.mov',
    size: 100,
    head: [0, 0, 0, 0, ...stringToBytes('ftyp'), ...stringToBytes('qt  ')],
    allowedTypes: ['mp3', 'jpeg'],
    maxMb: { audio: 10, video: 10, image: 10 },
    usedBytes: 0,
    quotaBytes: 100000,
  })
  expect(res.ok).toBe(false)
  if (!res.ok) {
    expect(res.code).toBe('media_type_not_allowed')
    expect(res.message).toBe('This file type is not allowed. Allowed: MP3, JPEG.')
  }
})

// Protects: limits enforcement.
test('[C7] boundary-condition: file size and quota boundaries', () => {
  const pngHead = [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]
  const tooLarge = checkUpload({
    fileName: 'pic.png',
    size: 2 * MIB + 1,
    head: pngHead,
    allowedTypes: ['png'],
    maxMb: { audio: 1, video: 1, image: 2 },
    usedBytes: 0,
    quotaBytes: 10 * MIB,
  })
  expect(tooLarge.ok).toBe(false)
  if (!tooLarge.ok) {
    expect(tooLarge.code).toBe('media_too_large')
  }

  const overQuota = checkUpload({
    fileName: 'pic.png',
    size: 1 * MIB,
    head: pngHead,
    allowedTypes: ['png'],
    maxMb: { audio: 1, video: 1, image: 2 },
    usedBytes: 9 * MIB + 1,
    quotaBytes: 10 * MIB,
  })
  expect(overQuota.ok).toBe(false)
  if (!overQuota.ok) {
    expect(overQuota.code).toBe('media_over_quota')
  }
})

// Protects: usedThrough ordering.
test('[C8] order-dependence: stable ordering by created then id', () => {
  const rows = [
    { id: '2', created: '2026-11-16T12:00:00.000Z', size: 10 },
    { id: '1', created: '2026-11-16T12:00:00.000Z', size: 20 },
  ]
  expect(usedThrough(rows, '1')).toBe(20)
  expect(usedThrough(rows, '2')).toBe(30)
})
