// Pure helpers for media upload checks and quotas (design 6.2, 7c).
const TYPES = ['wav', 'mp3', 'mov', 'mp4', 'jpeg', 'png']
const VIDEO = ['mov', 'mp4']
const PNG_HEADER = [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]
const MIB = 1048576
const GIB = 1024 * MIB

function extensionType(fileName) {
  if (typeof fileName !== 'string') return null
  const trimmed = fileName.trim()
  const dot = trimmed.lastIndexOf('.')
  if (dot === -1) return null
  const ext = trimmed.slice(dot + 1).toLowerCase()
  if (ext === 'jpg' || ext === 'jpeg') return 'jpeg'
  if (TYPES.includes(ext)) return ext
  return null
}

function quotaFor(defaultBytes, overrideBytes) {
  return overrideBytes > 0 ? overrideBytes : defaultBytes
}

function formatBytes(bytes) {
  if (bytes < MIB) {
    if (bytes <= 0) return '0 KB'
    return `${Math.ceil(bytes / 1024)} KB`
  }
  if (bytes < GIB) {
    return `${(bytes / MIB).toFixed(1)} MB`
  }
  return `${(bytes / GIB).toFixed(1)} GB`
}

function ascii4(head, offset) {
  return String.fromCharCode(head[offset], head[offset + 1], head[offset + 2], head[offset + 3])
}

function detectPng(head) {
  if (head.length < 8) return false
  for (let i = 0; i < 8; i++) {
    if (head[i] !== PNG_HEADER[i]) return false
  }
  return true
}

function detectWav(head) {
  if (head.length < 12) return false
  return ascii4(head, 0) === 'RIFF' && ascii4(head, 8) === 'WAVE'
}

function detectIsoVideo(head) {
  if (head.length < 8) return null
  const at4 = ascii4(head, 4)
  if (at4 === 'ftyp') {
    if (head.length < 12) return 'mp4'
    return ascii4(head, 8) === 'qt  ' ? 'mov' : 'mp4'
  }
  return ['moov', 'mdat', 'wide', 'free', 'skip'].includes(at4) ? 'mov' : null
}

function detectJpeg(head) {
  return head.length >= 3 && head[0] === 0xff && head[1] === 0xd8 && head[2] === 0xff
}

function detectId3(head) {
  return head.length >= 3 && head[0] === 0x49 && head[1] === 0x44 && head[2] === 0x33
}

function detectType(head) {
  if (!head || head.length < 2) return null
  if (detectPng(head)) return 'png'
  if (detectJpeg(head)) return 'jpeg'
  if (detectWav(head)) return 'wav'
  if (detectId3(head)) return 'mp3'
  if (head[0] === 0xff && (head[1] & 0xe0) === 0xe0) return "mp3"
  return detectIsoVideo(head)
}

function kindOf(type) {
  if (type === 'wav' || type === 'mp3') return 'audio'
  if (type === 'mov' || type === 'mp4') return 'video'
  return 'image'
}

function formatAllowed(allowedTypes) {
  return TYPES.filter((t) => allowedTypes.includes(t))
    .map((t) => t.toUpperCase())
    .join(', ')
}

function typeLabel(claimed) {
  return claimed === 'jpeg' ? 'JPEG' : claimed.toUpperCase()
}

function checkSizeAndQuota(input, kind) {
  if (input.size > input.maxMb[kind] * MIB) {
    return {
      ok: false,
      code: 'media_too_large',
      message: `This ${kind} file is larger than the ${input.maxMb[kind]} MB limit.`,
    }
  }
  if (input.usedBytes + input.size > input.quotaBytes) {
    const left = formatBytes(input.quotaBytes - input.usedBytes)
    const file = formatBytes(input.size)
    const quota = formatBytes(input.quotaBytes)
    return {
      ok: false,
      code: 'media_over_quota',
      message: `Not enough storage: this file is ${file} and you have ${left} of ${quota} left. Nothing was deleted.`,
    }
  }
  return null
}

function checkUpload(input) {
  const claimed = extensionType(input.fileName)
  if (!claimed || !input.allowedTypes.includes(claimed)) {
    return {
      ok: false,
      code: 'media_type_not_allowed',
      message: `This file type is not allowed. Allowed: ${formatAllowed(input.allowedTypes)}.`,
    }
  }
  const detected = detectType(input.head)
  const sameFamily = detected === claimed || (VIDEO.includes(detected) && VIDEO.includes(claimed))
  if (!detected || !sameFamily) {
    return {
      ok: false,
      code: 'media_not_real',
      message: `This file is not a real ${typeLabel(claimed)} file.`,
    }
  }
  if (!input.allowedTypes.includes(detected)) {
    return {
      ok: false,
      code: 'media_type_not_allowed',
      message: `This file type is not allowed. Allowed: ${formatAllowed(input.allowedTypes)}.`,
    }
  }
  const kind = kindOf(detected)
  const limitFailure = checkSizeAndQuota(input, kind)
  if (limitFailure) return limitFailure
  return { ok: true, type: detected, kind }
}

function usedThrough(rows, id) {
  const sorted = [...rows].sort((a, b) => {
    if (a.created < b.created) return -1
    if (a.created > b.created) return 1
    return a.id < b.id ? -1 : 1
  })
  let total = 0
  for (const row of sorted) {
    total += row.size
    if (row.id === id) return total
  }
  return total
}

module.exports = {
  TYPES,
  MIB,
  extensionType,
  quotaFor,
  formatBytes,
  detectType,
  kindOf,
  checkUpload,
  usedThrough,
}
