import { describe, expect, test } from 'vitest'
import { fromMediaRecord } from './media.ts'

describe('media mapping', () => {
  // Protects: a media record maps to the editor's type
  test("a media record maps to the editor's type", () => {
    const raw = {
      id: 'med123456789012',
      project: 'proj12345678901',
      node: 'node12345678901',
      uploader: 'user12345678901',
      title: 'Artwork.png',
      kind: 'image',
      size_bytes: 2048,
      file: 'abcde1234567890.png',
      created: '2026-11-19 09:00:00.000Z',
      removed_at: '',
    }

    const mapped = fromMediaRecord(raw)
    expect(mapped).toEqual({
      id: 'med123456789012',
      projectId: 'proj12345678901',
      nodeId: 'node12345678901',
      uploaderId: 'user12345678901',
      title: 'Artwork.png',
      kind: 'image',
      sizeBytes: 2048,
      fileName: 'abcde1234567890.png',
      created: '2026-11-19 09:00:00.000Z',
      removedAt: '',
    })

    // A removed file carries its removal time
    expect(fromMediaRecord({ ...raw, removed_at: '2026-11-20 08:00:00.000Z' }).removedAt).toBe(
      '2026-11-20 08:00:00.000Z',
    )

    // Unknown kind throws
    expect(() => fromMediaRecord({ ...raw, kind: 'executable' })).toThrow(/unknown kind/i)
  })
})
