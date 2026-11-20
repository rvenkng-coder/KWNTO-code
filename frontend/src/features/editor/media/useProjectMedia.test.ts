import { beforeEach, describe, expect, test, vi } from 'vitest'
import type { Media, MediaEvent } from '../../../backend/media-types.ts'

const door = vi.hoisted(() => ({
  list: vi.fn(),
  storage: vi.fn(),
  fileToken: vi.fn(),
  subscribe: vi.fn(),
  upload: vi.fn(),
  remove: vi.fn(),
}))
vi.mock('../../../backend/index.ts', () => ({ backend: { media: door } }))

import { useMediaStore } from './useProjectMedia.ts'

const STORAGE = { usedBytes: 0, quotaBytes: 1000, maxBytes: { audio: 1000, video: 1000, image: 1000 }, allowedTypes: ['png'], isLead: false }

function media(id: string, projectId = 'A'): Media {
  return { id, projectId, nodeId: 'n', uploaderId: 'u', title: id, kind: 'image', sizeBytes: 1, fileName: `${id}.png`, created: `2026-11-20 10:00:0${id.length}Z`, removedAt: '' }
}

function deferred<T>() {
  let resolve!: (v: T) => void
  const promise = new Promise<T>((r) => { resolve = r })
  return { promise, resolve }
}

describe('media store', () => {
  beforeEach(() => {
    vi.resetAllMocks()
    useMediaStore.getState().close()
    door.storage.mockResolvedValue(STORAGE)
    door.fileToken.mockResolvedValue('tok')
    door.subscribe.mockResolvedValue(() => {})
  })

  // Protects: a list that finishes after a project switch never overwrites the new project's media.
  test('a late response for the old project is dropped', async () => {
    const slow = deferred<Media[]>()
    door.list.mockReturnValueOnce(slow.promise)
    const opening = useMediaStore.getState().open('A')
    await Promise.resolve()
    useMediaStore.getState().close()
    useMediaStore.setState({ projectId: 'B' })
    slow.resolve([media('a1')])
    await opening
    expect(useMediaStore.getState().media).toEqual([])
    expect(useMediaStore.getState().projectId).toBe('B')
  })

  // Protects: the subscription is made before the list, and events in between are replayed over the list.
  test('events that arrive while the list loads are kept', async () => {
    const slow = deferred<Media[]>()
    door.list.mockReturnValueOnce(slow.promise)
    let emit: (e: MediaEvent) => void = () => {}
    door.subscribe.mockImplementationOnce((_p: string, cb: (e: MediaEvent) => void) => {
      emit = cb
      return Promise.resolve(() => {})
    })
    const opening = useMediaStore.getState().open('A')
    await vi.waitFor(() => expect(door.list).toHaveBeenCalled())
    emit({ action: 'create', record: media('late') })
    slow.resolve([media('a1')])
    await opening
    expect(useMediaStore.getState().media.map((m) => m.id).sort()).toEqual(['a1', 'late'])
  })

  // Protects: realtime being unavailable shows an error instead of an unhandled rejection.
  test('a failed subscribe is reported and open still resolves', async () => {
    door.list.mockResolvedValue([media('a1')])
    door.subscribe.mockRejectedValueOnce(new Error('no realtime'))
    const unsubscribe = await useMediaStore.getState().open('A')
    expect(typeof unsubscribe).toBe('function')
    expect(useMediaStore.getState().error).toBe('no realtime')
    expect(useMediaStore.getState().media).toHaveLength(1)
  })

  // Protects: the file token is renewed on demand, so media URLs do not expire mid-session.
  test('refreshing the file token replaces it for the open project only', async () => {
    door.list.mockResolvedValue([])
    await useMediaStore.getState().open('A')
    door.fileToken.mockResolvedValueOnce('fresh')
    await useMediaStore.getState().refreshFileToken()
    expect(useMediaStore.getState().fileToken).toBe('fresh')

    useMediaStore.getState().close()
    door.fileToken.mockClear()
    await useMediaStore.getState().refreshFileToken()
    expect(door.fileToken).not.toHaveBeenCalled()
    expect(useMediaStore.getState().fileToken).toBeNull()
  })

  // Protects: two uploads with one file name keep their own indicator until each finishes.
  test('same-named uploads are removed from the uploading list one at a time', async () => {
    door.list.mockResolvedValue([])
    await useMediaStore.getState().open('A')
    const first = deferred<Media>()
    const second = deferred<Media>()
    door.upload.mockReturnValueOnce(first.promise).mockReturnValueOnce(second.promise)
    const file = new File(['x'], 'image.png')
    const p1 = useMediaStore.getState().upload('n1', file)
    const p2 = useMediaStore.getState().upload('n2', file)
    expect(useMediaStore.getState().uploading).toEqual(['image.png', 'image.png'])
    first.resolve(media('m1'))
    await p1
    expect(useMediaStore.getState().uploading).toEqual(['image.png'])
    second.resolve(media('m22'))
    await p2
    expect(useMediaStore.getState().uploading).toEqual([])
  })
})
