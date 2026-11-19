import { describe, expect, test } from 'vitest'
import type { Media, MediaEvent, StorageInfo } from '../../../../frontend/src/backend/media-types.ts'
import { applyMediaEvent, mediaOf, meterText } from '../../../../frontend/src/features/editor/media/mediaList.ts'

function makeMedia(id: string, nodeId: string, created: string): Media {
  return {
    id,
    projectId: 'p1',
    nodeId,
    uploaderId: 'u1',
    title: `${id}.png`,
    kind: 'image',
    sizeBytes: 100,
    fileName: `f_${id}.png`,
    created,
  }
}

describe('task 4 probes: media list manipulation and meter display', () => {
  // Protects: duplicate create event deduplication and sorting.
  test('[C1] probe-echo-and-sorting: applyMediaEvent ignores duplicate creates and maintains created ordering', () => {
    const m1 = makeMedia('m1', 'n1', '2026-11-19 10:00:00.000Z')
    const m2 = makeMedia('m2', 'n1', '2026-11-19 10:05:00.000Z')
    const m3 = makeMedia('m3', 'n1', '2026-11-19 10:02:00.000Z')

    let list = applyMediaEvent([], { action: 'create', record: m1 })
    list = applyMediaEvent(list, { action: 'create', record: m2 })
    // Duplicate m1 should not be added again
    const echoEvent: MediaEvent = { action: 'create', record: m1 }
    list = applyMediaEvent(list, echoEvent)
    expect(list.length).toBe(2)

    // Inserting an out-of-order created record
    list = applyMediaEvent(list, { action: 'create', record: m3 })
    expect(list.map((m) => m.id)).toEqual(['m1', 'm3', 'm2'])
  })

  // Protects: delete handling for present and absent records.
  test('[C1] probe-delete-handling: applyMediaEvent handles deletion correctly', () => {
    const m1 = makeMedia('m1', 'n1', '2026-11-19 10:00:00.000Z')
    const m2 = makeMedia('m2', 'n2', '2026-11-19 10:01:00.000Z')
    let list: Media[] = [m1, m2]

    // Delete non-existent
    list = applyMediaEvent(list, { action: 'delete', record: makeMedia('m99', 'n1', '') })
    expect(list.length).toBe(2)

    // Delete m1
    list = applyMediaEvent(list, { action: 'delete', record: m1 })
    expect(list.map((m) => m.id)).toEqual(['m2'])
  })

  // Protects: filtering media by nodeId.
  test('[C1] probe-media-of: mediaOf filters strictly by nodeId', () => {
    const m1 = makeMedia('m1', 'n1', '2026-11-19 10:00:00.000Z')
    const m2 = makeMedia('m2', 'n2', '2026-11-19 10:01:00.000Z')
    const m3 = makeMedia('m3', 'n1', '2026-11-19 10:02:00.000Z')
    const list = [m1, m2, m3]

    expect(mediaOf(list, 'n1').map((m) => m.id)).toEqual(['m1', 'm3'])
    expect(mediaOf(list, 'n2').map((m) => m.id)).toEqual(['m2'])
    expect(mediaOf(list, 'n3')).toEqual([])
  })

  // Protects: meterText string format and size formatting.
  test('[C1] probe-meter-text: meterText outputs formatted string', () => {
    const info: StorageInfo = {
      usedBytes: 67,
      quotaBytes: 2147483648,
      maxBytes: { audio: 50 * 1048576, video: 200 * 1048576, image: 50 * 1048576 },
      allowedTypes: ['wav', 'mp3', 'mov', 'mp4', 'jpeg', 'png'],
    }
    expect(meterText(info)).toBe('Storage: 1 KB of 2.0 GB used')

    const zeroInfo: StorageInfo = { ...info, usedBytes: 0 }
    expect(meterText(zeroInfo)).toBe('Storage: 0 KB of 2.0 GB used')
  })
})
