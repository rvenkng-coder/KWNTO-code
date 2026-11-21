import { beforeEach, describe, expect, test, vi } from 'vitest'
import type { NodeLink } from '../../../backend/link-types.ts'

const door = vi.hoisted(() => ({
  list: vi.fn(),
  add: vi.fn(),
  remove: vi.fn(),
  subscribe: vi.fn(),
}))
vi.mock('../../../backend/index.ts', () => ({ backend: { links: door } }))

import { useLinksStore } from './useProjectLinks.ts'

function link(id: string): NodeLink {
  return { id, projectId: 'A', nodeId: 'n1', creatorId: 'u', title: id, url: `https://${id}.example`, created: '2026-11-21 10:00:00Z' }
}

function deferred<T>() {
  let resolve!: (v: T) => void
  const promise = new Promise<T>((r) => { resolve = r })
  return { promise, resolve }
}

describe('links store', () => {
  beforeEach(() => {
    vi.resetAllMocks()
    useLinksStore.getState().close()
    door.subscribe.mockResolvedValue(() => {})
    door.list.mockResolvedValue([])
  })

  // Protects: a bad address is refused in the browser, before any request, and a late answer for an
  // old project never lands in the new one (C3)
  test('the store refuses bad addresses and drops late answers', async () => {
    await useLinksStore.getState().open('A')
    const refused = await useLinksStore.getState().add('n1', 't', 'javascript:alert(1)')
    expect(refused).toBe(false)
    expect(useLinksStore.getState().error).toBe('Only http:// and https:// addresses are allowed.')
    expect(door.add).not.toHaveBeenCalled()

    const slow = deferred<NodeLink>()
    door.add.mockReturnValueOnce(slow.promise)
    const adding = useLinksStore.getState().add('n1', 't', ' https://ok.example ')
    await vi.waitFor(() => expect(door.add).toHaveBeenCalledWith('A', 'n1', 't', 'https://ok.example'))
    useLinksStore.getState().close()
    useLinksStore.setState({ projectId: 'B' })
    slow.resolve(link('late'))
    await adding
    expect(useLinksStore.getState().links).toEqual([])
    expect(useLinksStore.getState().projectId).toBe('B')
  })

  // Protects: a double click or a double Enter adds one link, not two (final review, Important 2)
  test('a second submit while the first is in flight adds nothing', async () => {
    await useLinksStore.getState().open('A')
    const slow = deferred<NodeLink>()
    door.add.mockReturnValueOnce(slow.promise)

    const first = useLinksStore.getState().add('n1', 't', 'https://ok.example')
    const second = useLinksStore.getState().add('n1', 't', 'https://ok.example')
    expect(await second).toBe(false)
    slow.resolve(link('one'))
    expect(await first).toBe(true)

    expect(door.add).toHaveBeenCalledTimes(1)
    expect(useLinksStore.getState().links.map((l) => l.id)).toEqual(['one'])
  })
})
