import { describe, expect, test } from 'vitest'
import type { StorageInfo } from '../../../backend/media-types.ts'
import { acceptFor, earlyProblem, formatSize } from './uploadCheck.ts'

describe('early upload check and formatSize', () => {
  // Protects: the browser refuses early with the server's words (C3)
  test("the browser refuses early with the server's words", () => {
    const info: StorageInfo = {
      usedBytes: 50 * 1048576,
      quotaBytes: 100 * 1048576,
      maxBytes: {
        audio: 50 * 1048576,
        video: 200 * 1048576,
        image: 100 * 1048576,
      },
      allowedTypes: ['wav', 'mp3', 'mov', 'mp4', 'jpeg', 'png'],
      isLead: false,
    }

    // a.gif -> type not allowed
    expect(earlyProblem({ name: 'a.gif', size: 1024 }, info)).toBe(
      'This file type is not allowed. Allowed: WAV, MP3, MOV, MP4, JPEG, PNG.',
    )

    // a 201 MiB a.mp4 (video max 200 MiB) -> too large
    expect(earlyProblem({ name: 'a.mp4', size: 201 * 1048576 }, info)).toBe(
      'This video file is larger than the 200 MB limit.',
    )

    // a 60 MB a.png with 50 MB free -> over quota
    expect(earlyProblem({ name: 'a.png', size: 60 * 1048576 }, info)).toBe(
      'Not enough storage: this file is 60.0 MB and you have 50.0 MB of 100.0 MB left. Nothing was deleted.',
    )

    // a fine a.png -> null
    expect(earlyProblem({ name: 'a.png', size: 10 * 1048576 }, info)).toBeNull()

    // formatSize of 0, 12000, 209715200
    expect(formatSize(0)).toBe('0 KB')
    expect(formatSize(12000)).toBe('12 KB')
    expect(formatSize(209715200)).toBe('200.0 MB')
  })
})

describe('acceptFor', () => {
  // Protects: the picker offers exactly the allowed types (plan node-links, Task 1 C1)
  test('acceptFor lists every allowed extension', () => {
    expect(acceptFor(['wav', 'mp3', 'mov', 'mp4', 'jpeg', 'png'])).toBe('.wav,.mp3,.mov,.mp4,.jpg,.jpeg,.png')
  })

  // Protects: video off means the picker no longer offers video (C2)
  test('acceptFor leaves out a type that is off', () => {
    expect(acceptFor(['wav', 'mp3', 'jpeg', 'png'])).toBe('.wav,.mp3,.jpg,.jpeg,.png')
  })

  // Protects: before the list is known the picker does not filter; the server still refuses (C3)
  test('acceptFor gives no filter without a list', () => {
    expect(acceptFor(null)).toBe('')
    expect(acceptFor([])).toBe('')
  })
})

describe('ogg, m4a and opus', () => {
  const info: StorageInfo = {
    usedBytes: 0,
    quotaBytes: 100 * 1048576,
    isLead: false,
    maxBytes: { audio: 1048576, video: 200 * 1048576, image: 100 * 1048576 },
    allowedTypes: ['wav', 'mp3', 'ogg', 'm4a', 'opus', 'jpeg', 'png'],
  }

  // Protects: the new audio formats pass the early check, count as audio and appear in the file picker
  test('the new audio formats are accepted early, limited as audio and offered by the picker', () => {
    for (const name of ['a.ogg', 'a.M4A', 'a.opus']) expect(earlyProblem({ name, size: 1024 }, info)).toBeNull()
    expect(earlyProblem({ name: 'a.opus', size: 2 * 1048576 }, info)).toBe(
      'This audio file is larger than the 1 MB limit.',
    )
    expect(acceptFor(info.allowedTypes)).toBe('.wav,.mp3,.ogg,.m4a,.opus,.jpg,.jpeg,.png')
  })
})
