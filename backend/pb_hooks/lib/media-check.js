// Pure helpers for media upload checks and quotas (design 6.2, 7c).
const TYPES = ['wav', 'mp3', 'mov', 'mp4', 'jpeg', 'png']
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

module.exports = {
  TYPES,
  MIB,
  extensionType,
  quotaFor,
  formatBytes,
}
