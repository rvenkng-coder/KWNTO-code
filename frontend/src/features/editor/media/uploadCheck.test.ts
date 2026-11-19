import { describe, expect, test } from 'vitest'
import type { StorageInfo } from '../../../backend/media-types.ts'
import { earlyProblem, formatSize } from './uploadCheck.ts'

describe('early upload check and formatSize', () => {
  // Protects: the browser refuses early with the server's words (C3)
  test('the browser refuses early with the server\'s words', () => {
    const info: StorageInfo = {
      usedBytes: 50 * 1048576,
      quotaBytes: 100 * 1048576,
      maxBytes: {
        audio: 50 * 1048576,
        video: 200 * 1048576,
        image: 100 * 1048576,
      },
      allowedTypes: ['wav', 'mp3', 'mov', 'mp4', 'jpeg', 'png'],
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
