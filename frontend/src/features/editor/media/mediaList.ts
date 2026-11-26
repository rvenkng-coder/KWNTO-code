import type { Media, MediaEvent, StorageInfo } from '../../../backend/media-types.ts'
import { formatSize } from './uploadCheck.ts'

export function applyMediaEvent(list: Media[], event: MediaEvent): Media[] {
  if (event.action === 'create') {
    if (list.some((m) => m.id === event.record.id)) return list
    const next = [...list, event.record]
    next.sort((a, b) => a.created.localeCompare(b.created))
    return next
  }
  if (event.action === 'update') {
    return list.map((m) => (m.id === event.record.id ? event.record : m))
  }
  if (event.action === 'delete') {
    return list.filter((m) => m.id !== event.record.id)
  }
  return list
}

// The picture shown on top of a node's card: the media file the node names as its cover, while it is an image still in use.
export function coverOf(list: Media[], coverMediaId: string): Media | undefined {
  if (coverMediaId === '') return undefined
  return list.find((m) => m.id === coverMediaId && m.kind === 'image' && m.removedAt === '')
}

// Media in the node's media section and on its card: the cover is shown on its own, so it is left out.
export function mediaOf(list: Media[], nodeId: string, coverMediaId = ''): Media[] {
  return list.filter((m) => m.nodeId === nodeId && m.removedAt === '' && m.id !== coverMediaId)
}

// Media a member removed from a node, which only the team lead sees and can restore or delete.
export function removedOf(list: Media[], nodeId: string): Media[] {
  return list.filter((m) => m.nodeId === nodeId && m.removedAt !== '')
}

export function meterText(info: StorageInfo): string {
  const used = formatSize(info.usedBytes)
  const quota = formatSize(info.quotaBytes)
  return `Team storage: ${used} of ${quota} used`
}
