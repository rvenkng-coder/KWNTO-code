import type { MediaKind, StorageInfo } from '../../../backend/media-types.ts'

const ORDERED_TYPES = ['wav', 'mp3', 'ogg', 'm4a', 'opus', 'mov', 'mp4', 'jpeg', 'png']
const AUDIO_TYPES = ['wav', 'mp3', 'ogg', 'm4a', 'opus']
const MIB = 1048576
const GIB = 1024 * MIB

export function formatSize(bytes: number): string {
  if (bytes < MIB) {
    if (bytes <= 0) return '0 KB'
    return `${Math.ceil(bytes / 1024)} KB`
  }
  if (bytes < GIB) {
    return `${(bytes / MIB).toFixed(1)} MB`
  }
  return `${(bytes / GIB).toFixed(1)} GB`
}

function getExtension(fileName: string): string | null {
  if (typeof fileName !== 'string') return null
  const trimmed = fileName.trim()
  const dot = trimmed.lastIndexOf('.')
  if (dot === -1) return null
  const ext = trimmed.slice(dot + 1).toLowerCase()
  if (ext === 'jpg' || ext === 'jpeg') return 'jpeg'
  return ext
}

function kindOf(type: string): MediaKind {
  if (AUDIO_TYPES.includes(type)) return 'audio'
  if (type === 'mov' || type === 'mp4') return 'video'
  return 'image'
}

const EXTENSIONS: Record<string, string> = {
  wav: '.wav',
  mp3: '.mp3',
  ogg: '.ogg',
  m4a: '.m4a',
  opus: '.opus',
  mov: '.mov',
  mp4: '.mp4',
  jpeg: '.jpg,.jpeg',
  png: '.png',
}

// The file picker's `accept` list for the allowed types; empty (no filter) until the list is known.
export function acceptFor(allowedTypes: string[] | null): string {
  if (!allowedTypes) return ''
  return ORDERED_TYPES.filter((t) => allowedTypes.includes(t))
    .map((t) => EXTENSIONS[t])
    .join(',')
}

function formatAllowed(allowedTypes: string[]): string {
  return ORDERED_TYPES.filter((t) => allowedTypes.includes(t))
    .map((t) => t.toUpperCase())
    .join(', ')
}

export function earlyProblem(file: { name: string; size: number }, info: StorageInfo): string | null {
  const ext = getExtension(file.name)
  if (!ext || !info.allowedTypes.includes(ext)) {
    return `This file type is not allowed. Allowed: ${formatAllowed(info.allowedTypes)}.`
  }
  const kind = kindOf(ext)
  const maxBytes = info.maxBytes[kind]
  if (file.size > maxBytes) {
    const maxMb = Math.round(maxBytes / MIB)
    return `This ${kind} file is larger than the ${maxMb} MB limit.`
  }
  if (info.usedBytes + file.size > info.quotaBytes) {
    const remaining = Math.max(0, info.quotaBytes - info.usedBytes)
    return `Not enough storage: this file is ${formatSize(file.size)} and you have ${formatSize(remaining)} of ${formatSize(info.quotaBytes)} left. Nothing was deleted.`
  }
  return null
}
