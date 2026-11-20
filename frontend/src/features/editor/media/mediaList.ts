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

// Media in use on a node; removed media is hidden from everyone.
export function mediaOf(list: Media[], nodeId: string): Media[] {
  return list.filter((m) => m.nodeId === nodeId && m.removedAt === '')
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
