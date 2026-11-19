import type { Media, MediaEvent, StorageInfo } from '../../../backend/media-types.ts'
import { formatSize } from './uploadCheck.ts'

export function applyMediaEvent(list: Media[], event: MediaEvent): Media[] {
  if (event.action === 'create') {
    if (list.some((m) => m.id === event.record.id)) return list
    const next = [...list, event.record]
    next.sort((a, b) => a.created.localeCompare(b.created))
    return next
  }
  if (event.action === 'delete') {
    return list.filter((m) => m.id !== event.record.id)
  }
  return list
}

export function mediaOf(list: Media[], nodeId: string): Media[] {
  return list.filter((m) => m.nodeId === nodeId)
}

export function meterText(info: StorageInfo): string {
  const used = formatSize(info.usedBytes)
  const quota = formatSize(info.quotaBytes)
  return `Storage: ${used} of ${quota} used`
}
