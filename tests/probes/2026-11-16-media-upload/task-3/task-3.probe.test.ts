import { describe, expect, test, vi } from 'vitest'
import { createFileTokens, TOKEN_REUSE_MS } from '../../../../frontend/src/backend/file-tokens.ts'
import { fromMediaRecord } from '../../../../frontend/src/backend/media.ts'
import type { StorageInfo } from '../../../../frontend/src/backend/media-types.ts'
import { earlyProblem, formatSize } from '../../../../frontend/src/features/editor/media/uploadCheck.ts'

describe('task 3 probes: mapping, tokens, early problem checks', () => {
  // Protects: fromMediaRecord mapping with various shapes.
  test('[C1] boundary-inputs: fromMediaRecord correctly maps snake_case to camelCase and validates kind', () => {
    const row = {
      id: 'm1',
      project: 'p1',
      node: 'n1',
      uploader: 'u1',
      title: 'Title.png',
      kind: 'image',
      size_bytes: 500,
      file: 'random15chars.png',
      created: '2026-11-19 09:00:00.000Z',
    }
    const media = fromMediaRecord(row)
    expect(media).toEqual({
      id: 'm1',
      projectId: 'p1',
      nodeId: 'n1',
      uploaderId: 'u1',
      title: 'Title.png',
      kind: 'image',
      sizeBytes: 500,
      fileName: 'random15chars.png',
      created: '2026-11-19 09:00:00.000Z',
    })

    expect(() => fromMediaRecord({ ...row, kind: 'unknown' })).toThrow(/unknown kind/i)
    expect(() => fromMediaRecord({ ...row, kind: '' })).toThrow(/unknown kind/i)
  })

  // Protects: token caching and concurrency.
  test('[C2] token-cache-boundaries: createFileTokens handles expiry, parallel calls, and transient errors', async () => {
    let clock = 1_000_000
    let fetchCount = 0
    let shouldFail = false

    const fetchToken = vi.fn(async () => {
      fetchCount++
      if (shouldFail) {
        throw new Error('fetch error')
      }
      return `tok-${fetchCount}`
    })

    const tokens = createFileTokens(fetchToken, () => clock)

    // Parallel calls share one in-flight fetch
    const [t1, t2] = await Promise.all([tokens.get(), tokens.get()])
    expect(t1).toBe('tok-1')
    expect(t2).toBe('tok-1')
    expect(fetchCount).toBe(1)

    // Before reuse window expiration
    clock += TOKEN_REUSE_MS - 1
    expect(await tokens.get()).toBe('tok-1')
    expect(fetchCount).toBe(1)

    // At or after expiration
    clock += 2
    expect(await tokens.get()).toBe('tok-2')
    expect(fetchCount).toBe(2)

    // Failed fetch is not cached
    shouldFail = true
    clock += TOKEN_REUSE_MS + 10
    await expect(tokens.get()).rejects.toThrow('fetch error')
    shouldFail = false
    expect(await tokens.get()).toBe('tok-4')
  })

  // Protects: byte formatting.
  test('[C3] format-size-extremes: formatSize matches server formatBytes across ranges', () => {
    expect(formatSize(0)).toBe('0 KB')
    expect(formatSize(100)).toBe('1 KB')
    expect(formatSize(12000)).toBe('12 KB')
    expect(formatSize(1048576)).toBe('1.0 MB')
    expect(formatSize(1572864)).toBe('1.5 MB')
    expect(formatSize(209715200)).toBe('200.0 MB')
    expect(formatSize(1073741824)).toBe('1.0 GB')
    expect(formatSize(1610612736)).toBe('1.5 GB')
  })

  // Protects: earlyProblem edge cases.
  test('[C4] early-problem-boundaries: earlyProblem handles case, size, and quota limits', () => {
    const info: StorageInfo = {
      usedBytes: 1000,
      quotaBytes: 2000,
      maxBytes: {
        audio: 50 * 1048576,
        video: 200 * 1048576,
        image: 50 * 1048576,
      },
      allowedTypes: ['wav', 'mp3', 'mov', 'mp4', 'jpeg', 'png'],
    }

    // Type not allowed
    expect(earlyProblem({ name: 'file.gif', size: 100 }, info)).toBe(
      'This file type is not allowed. Allowed: WAV, MP3, MOV, MP4, JPEG, PNG.',
    )
    expect(earlyProblem({ name: 'file', size: 100 }, info)).toBe(
      'This file type is not allowed. Allowed: WAV, MP3, MOV, MP4, JPEG, PNG.',
    )

    // Too large
    expect(earlyProblem({ name: 'clip.mp4', size: 201 * 1048576 }, info)).toBe(
      'This video file is larger than the 200 MB limit.',
    )
    expect(earlyProblem({ name: 'photo.png', size: 51 * 1048576 }, info)).toBe(
      'This image file is larger than the 50 MB limit.',
    )

    // Over quota
    expect(earlyProblem({ name: 'photo.png', size: 1001 }, info)).toBe(
      'Not enough storage: this file is 1 KB and you have 1 KB of 2 KB left. Nothing was deleted.',
    )

    // Fine -> null
    expect(earlyProblem({ name: 'photo.PNG', size: 500 }, info)).toBeNull()
  })
})
