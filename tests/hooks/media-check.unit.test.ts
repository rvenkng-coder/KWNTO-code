import { createRequire } from 'node:module'
import { describe, expect, test } from 'vitest'

const require = createRequire(import.meta.url)
const {
  extensionType,
  quotaFor,
  formatBytes,
  detectType,
  kindOf,
  checkUpload,
  usedThrough,
  MIB,
} = require('../../backend/pb_hooks/lib/media-check.js') as {
  extensionType: (fileName: string) => string | null
  quotaFor: (defaultBytes: number, overrideBytes: number) => number
  formatBytes: (bytes: number) => string
  detectType: (head: number[]) => string | null
  kindOf: (type: string) => 'audio' | 'video' | 'image'
  checkUpload: (input: {
    fileName: string
    size: number
    head: number[]
    allowedTypes: string[]
    maxMb: { audio: number; video: number; image: number }
    usedBytes: number
    quotaBytes: number
  }) => { ok: true; type: string; kind: 'audio' | 'video' | 'image' } | { ok: false; code: string; message: string }
  usedThrough: (rows: Array<{ id: string; created: string; size: number }>, id: string) => number
  MIB: number
}

function stringToBytes(str: string): number[] {
  return Array.from(Buffer.from(str, 'ascii'))
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
    expect(kindOf('wav')).toBe('audio')
    expect(kindOf('mov')).toBe('video')
    expect(kindOf('jpeg')).toBe('image')

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

describe('media-check type detection and full check', () => {
  // Protects: each allowed type is known by its first bytes
  test('each allowed type is known by its first bytes', () => {
    expect(detectType([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])).toBe('png')
    expect(detectType([0xff, 0xd8, 0xff, 0xe0])).toBe('jpeg')

    const wavHead = [...stringToBytes('RIFF'), 0, 0, 0, 0, ...stringToBytes('WAVE'), 0, 0, 0, 0]
    expect(detectType(wavHead)).toBe('wav')

    expect(detectType(stringToBytes('ID3'))).toBe('mp3')
    expect(detectType([0xff, 0xfb, 0, 0])).toBe('mp3')
    expect(detectType([0xff, 0xf3, 0, 0])).toBe('mp3')

    const movFtyp = [0, 0, 0, 0, ...stringToBytes('ftyp'), ...stringToBytes('qt  ')]
    expect(detectType(movFtyp)).toBe('mov')

    const mp4Isom = [0, 0, 0, 0, ...stringToBytes('ftyp'), ...stringToBytes('isom')]
    expect(detectType(mp4Isom)).toBe('mp4')

    const mp42 = [0, 0, 0, 0, ...stringToBytes('ftyp'), ...stringToBytes('mp42')]
    expect(detectType(mp42)).toBe('mp4')

    const moov = [0, 0, 0, 0, ...stringToBytes('moov'), 0, 0, 0, 0]
    expect(detectType(moov)).toBe('mov')

    const wide = [0, 0, 0, 0, ...stringToBytes('wide'), 0, 0, 0, 0]
    expect(detectType(wide)).toBe('mov')
  })

  // Protects: other files and short files are not media
  test('other files and short files are not media', () => {
    expect(detectType(stringToBytes('<!doctype html>'))).toBeNull()
    expect(detectType(stringToBytes('%PDF-'))).toBeNull()
    expect(detectType(new Array(16).fill(0))).toBeNull()

    const aviHead = [...stringToBytes('RIFF'), 0, 0, 0, 0, ...stringToBytes('AVI ')]
    expect(detectType(aviHead)).toBeNull()

    expect(detectType([0xff, 0xd8])).toBeNull()
    expect(detectType([])).toBeNull()
    expect(detectType(stringToBytes('GIF89a'))).toBeNull()
    expect(detectType([0xff, 0x00])).toBeNull()
  })

  // Protects: a file whose bytes do not match its name is refused
  test('a file whose bytes do not match its name is refused', () => {
    const pngBytes = [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]
    const jpegBytes = [0xff, 0xd8, 0xff, 0xe0]
    const mp4Bytes = [0, 0, 0, 0, ...stringToBytes('ftyp'), ...stringToBytes('isom')]
    const htmlBytes = stringToBytes('<!doctype html>')
    const zeroBytes = new Array(16).fill(0)

    const baseInput = {
      size: 1000,
      allowedTypes: ['wav', 'mp3', 'mov', 'mp4', 'jpeg', 'png'],
      maxMb: { audio: 50, video: 200, image: 50 },
      usedBytes: 0,
      quotaBytes: 2 * 1024 * MIB,
    }

    expect(checkUpload({ ...baseInput, fileName: 'song.mp3', head: pngBytes })).toEqual({
      ok: false,
      code: 'media_not_real',
      message: 'This file is not a real MP3 file.',
    })

    expect(checkUpload({ ...baseInput, fileName: 'photo.jpg', head: htmlBytes })).toEqual({
      ok: false,
      code: 'media_not_real',
      message: 'This file is not a real JPEG file.',
    })

    expect(checkUpload({ ...baseInput, fileName: 'a.wav', head: zeroBytes })).toEqual({
      ok: false,
      code: 'media_not_real',
      message: 'This file is not a real WAV file.',
    })

    expect(checkUpload({ ...baseInput, fileName: 'a.jpg', head: jpegBytes })).toEqual({
      ok: true,
      type: 'jpeg',
      kind: 'image',
    })

    expect(checkUpload({ ...baseInput, fileName: 'clip.mov', head: mp4Bytes })).toEqual({
      ok: true,
      type: 'mp4',
      kind: 'video',
    })
  })

  // Protects: only types on the admin's list are allowed
  test('only types on the admin\'s list are allowed', () => {
    const pngBytes = [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]
    const mp4Bytes = [0, 0, 0, 0, ...stringToBytes('ftyp'), ...stringToBytes('isom')]
    const baseInput = {
      size: 1000,
      maxMb: { audio: 50, video: 200, image: 50 },
      usedBytes: 0,
      quotaBytes: 2 * 1024 * MIB,
    }

    expect(
      checkUpload({
        ...baseInput,
        fileName: 'a.gif',
        head: stringToBytes('GIF89a'),
        allowedTypes: ['wav', 'mp3', 'mov', 'mp4', 'jpeg', 'png'],
      }),
    ).toEqual({
      ok: false,
      code: 'media_type_not_allowed',
      message: 'This file type is not allowed. Allowed: WAV, MP3, MOV, MP4, JPEG, PNG.',
    })

    expect(
      checkUpload({
        ...baseInput,
        fileName: 'a.png',
        head: pngBytes,
        allowedTypes: ['wav', 'mp3', 'mov', 'mp4', 'jpeg'],
      }),
    ).toEqual({
      ok: false,
      code: 'media_type_not_allowed',
      message: 'This file type is not allowed. Allowed: WAV, MP3, MOV, MP4, JPEG.',
    })

    expect(
      checkUpload({
        ...baseInput,
        fileName: 'clip.mov',
        head: mp4Bytes,
        allowedTypes: ['wav', 'mp3', 'mov', 'jpeg', 'png'],
      }),
    ).toEqual({
      ok: false,
      code: 'media_type_not_allowed',
      message: 'This file type is not allowed. Allowed: WAV, MP3, MOV, JPEG, PNG.',
    })
  })

  // Protects: size and quota limits refuse with the limit named
  test('size and quota limits refuse with the limit named', () => {
    const mp4Bytes = [0, 0, 0, 0, ...stringToBytes('ftyp'), ...stringToBytes('isom')]
    const pngBytes = [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]
    const maxMb = { audio: 50, video: 200, image: 50 }
    const allowedTypes = ['wav', 'mp3', 'mov', 'mp4', 'jpeg', 'png']

    expect(
      checkUpload({
        fileName: 'clip.mp4',
        head: mp4Bytes,
        size: 200 * MIB,
        allowedTypes,
        maxMb,
        usedBytes: 0,
        quotaBytes: 2 * 1024 * MIB,
      }),
    ).toEqual({
      ok: true,
      type: 'mp4',
      kind: 'video',
    })

    expect(
      checkUpload({
        fileName: 'clip.mp4',
        head: mp4Bytes,
        size: 200 * MIB + 1,
        allowedTypes,
        maxMb,
        usedBytes: 0,
        quotaBytes: 2 * 1024 * MIB,
      }),
    ).toEqual({
      ok: false,
      code: 'media_too_large',
      message: 'This video file is larger than the 200 MB limit.',
    })

    expect(
      checkUpload({
        fileName: 'photo.png',
        head: pngBytes,
        size: 50 * MIB + 1,
        allowedTypes,
        maxMb,
        usedBytes: 0,
        quotaBytes: 2 * 1024 * MIB,
      }),
    ).toEqual({
      ok: false,
      code: 'media_too_large',
      message: 'This image file is larger than the 50 MB limit.',
    })

    expect(
      checkUpload({
        fileName: 'clip.mp4',
        head: mp4Bytes,
        size: 200 * MIB,
        allowedTypes,
        maxMb,
        usedBytes: 2040109466,
        quotaBytes: 2147483648,
      }),
    ).toEqual({
      ok: false,
      code: 'media_over_quota',
      message: 'Not enough storage: this file is 200.0 MB and you have 102.4 MB of 2.0 GB left. Nothing was deleted.',
    })

    expect(
      checkUpload({
        fileName: 'clip.mp4',
        head: mp4Bytes,
        size: 107374182,
        allowedTypes,
        maxMb,
        usedBytes: 2040109466,
        quotaBytes: 2147483648,
      }),
    ).toEqual({
      ok: true,
      type: 'mp4',
      kind: 'video',
    })
  })

  // Protects: parallel uploads are counted in one fixed order
  test('parallel uploads are counted in one fixed order', () => {
    const rows = [
      { id: 'b', created: '2026-11-16T12:00:00.000Z', size: 600 },
      { id: 'a', created: '2026-11-16T12:00:00.000Z', size: 600 },
      { id: 'c', created: '2026-11-16T11:59:00.000Z', size: 100 },
    ]

    expect(usedThrough(rows, 'a')).toBe(700)
    expect(usedThrough(rows, 'b')).toBe(1300)
    expect(usedThrough(rows, 'c')).toBe(100)
    expect(usedThrough(rows, 'zz')).toBe(1300)
  })
})

describe('media-check ogg, m4a and opus', () => {
  const allowedTypes = ['wav', 'mp3', 'ogg', 'm4a', 'opus', 'jpeg', 'png']
  const base = { size: 1000, allowedTypes, maxMb: { audio: 50, video: 200, image: 50 }, usedBytes: 0, quotaBytes: 2 * 1024 * MIB }
  const oggHead = [...stringToBytes('OggS'), 0, 2, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0]
  const m4aHead = [0, 0, 0, 0x20, ...stringToBytes('ftyp'), ...stringToBytes('M4A '), 0, 0, 0, 0]
  const isomHead = [0, 0, 0, 0x20, ...stringToBytes('ftyp'), ...stringToBytes('isom'), 0, 0, 0, 0]

  // Protects: the three new audio formats are recognised by name, by content and as audio
  test('the new formats are known by name and by their first bytes', () => {
    expect(extensionType('a.ogg')).toBe('ogg')
    expect(extensionType('a.M4A')).toBe('m4a')
    expect(extensionType('a.opus')).toBe('opus')
    expect(detectType(oggHead)).toBe('ogg')
    expect(detectType(m4aHead)).toBe('m4a')
    for (const t of ['ogg', 'm4a', 'opus']) expect(kindOf(t)).toBe('audio')
  })

  // Protects: an uploaded .ogg, .opus or .m4a is accepted as audio when its bytes fit
  test('real files are accepted as audio', () => {
    expect(checkUpload({ ...base, fileName: 'a.ogg', head: oggHead })).toEqual({ ok: true, type: 'ogg', kind: 'audio' })
    expect(checkUpload({ ...base, fileName: 'a.opus', head: oggHead })).toEqual({ ok: true, type: 'opus', kind: 'audio' })
    expect(checkUpload({ ...base, fileName: 'a.m4a', head: m4aHead })).toEqual({ ok: true, type: 'm4a', kind: 'audio' })
    expect(checkUpload({ ...base, fileName: 'a.m4a', head: isomHead })).toEqual({ ok: true, type: 'm4a', kind: 'audio' })
  })

  // Protects: a wrong name, wrong bytes or a switched-off type is still refused, and a video is not an m4a
  test('the wrong bytes or a type switched off are refused', () => {
    const fake = checkUpload({ ...base, fileName: 'a.ogg', head: stringToBytes('<!doctype html>') })
    expect(fake).toMatchObject({ ok: false, code: 'media_not_real' })
    expect(checkUpload({ ...base, fileName: 'a.mp3', head: oggHead })).toMatchObject({ ok: false, code: 'media_not_real' })
    expect(checkUpload({ ...base, fileName: 'a.ogg', head: m4aHead })).toMatchObject({ ok: false, code: 'media_not_real' })
    expect(checkUpload({ ...base, allowedTypes: ['wav', 'mp3'], fileName: 'a.opus', head: oggHead })).toMatchObject({ ok: false, code: 'media_type_not_allowed' })
    expect(checkUpload({ ...base, fileName: 'a.mp4', head: m4aHead })).toMatchObject({ ok: false })
  })
})
