import { describe, expect, test } from 'vitest'
import type { Media, MediaEvent, StorageInfo } from '../../../backend/media-types.ts'
import { applyMediaEvent, mediaOf, meterText } from './mediaList.ts'

function makeMedia(id: string, nodeId: string, created: string): Media {
  return {
    id,
    projectId: 'proj-1',
    nodeId,
    uploaderId: 'user-1',
    title: `file-${id}.png`,
    kind: 'image',
    sizeBytes: 100,
    fileName: `f_${id}.png`,
    created,
  }
}

describe('mediaList', () => {
  // Protects: deduplication of echo events, deletion, node filtering, and meter text formatting.
  test('the media list takes events once and filters by node', () => {
    const m1 = makeMedia('m1', 'node-a', '2026-11-19 10:00:00.000Z')
    const m2 = makeMedia('m2', 'node-b', '2026-11-19 10:05:00.000Z')
    const m3 = makeMedia('m3', 'node-a', '2026-11-19 10:02:00.000Z')

    // Create event of a new file
    let list: Media[] = []
    list = applyMediaEvent(list, { action: 'create', record: m1 })
    list = applyMediaEvent(list, { action: 'create', record: m2 })
    expect(list.length).toBe(2)

    // The same create again (our own echo)
    const echoEvent: MediaEvent = { action: 'create', record: m1 }
    list = applyMediaEvent(list, echoEvent)
    expect(list.length).toBe(2)
    expect(list.filter((m) => m.id === 'm1').length).toBe(1)

    // Append m3 and ensure sorted by created
    list = applyMediaEvent(list, { action: 'create', record: m3 })
    expect(list.map((m) => m.id)).toEqual(['m1', 'm3', 'm2'])

    // Delete m2
    list = applyMediaEvent(list, { action: 'delete', record: m2 })
    expect(list.map((m) => m.id)).toEqual(['m1', 'm3'])

    // mediaOf for a node
    const nodeAFiles = mediaOf(list, 'node-a')
    expect(nodeAFiles.map((m) => m.id)).toEqual(['m1', 'm3'])
    const nodeBFiles = mediaOf(list, 'node-b')
    expect(nodeBFiles).toEqual([])

    // meterText with 67 used of 2147483648
    const info: StorageInfo = {
      usedBytes: 67,
      quotaBytes: 2147483648,
      maxBytes: {
        audio: 50 * 1048576,
        video: 200 * 1048576,
        image: 50 * 1048576,
      },
      allowedTypes: ['wav', 'mp3', 'mov', 'mp4', 'jpeg', 'png'],
    }
    expect(meterText(info)).toBe('Storage: 1 KB of 2.0 GB used')
  })
})
