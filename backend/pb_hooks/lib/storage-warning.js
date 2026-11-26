// The decisions behind the disk-usage warning (design 7c): when the admin
// is warned and what the mail subject says. Pure, so Vitest tests it.
// CommonJS so hooks can load it with require(`${__hooks}/lib/storage-warning.js`).

const DAY_MS = 86400000

// True when usedBytes passes limitBytes, the warning is on (limit above 0), and no
// warning went out in the last 24 hours (lastWarnedMs is null if none ever did).
function shouldWarn(usedBytes, limitBytes, lastWarnedMs, nowMs) {
  if (!(usedBytes > limitBytes)) return false
  if (!(limitBytes > 0)) return false
  if (lastWarnedMs === null) return true
  return nowMs - lastWarnedMs >= DAY_MS
}

function warningSubject(usedBytes, limitBytes) {
  // Inside PocketBase `__hooks` is the hooks folder; under Vitest it is not defined.
  const folder = typeof __hooks === "string" ? `${__hooks}/lib` : "."
  const { formatBytes } = require(`${folder}/media-check.js`)
  return `KWNTO storage warning: ${formatBytes(usedBytes)} of ${formatBytes(limitBytes)} used`
}

module.exports = { shouldWarn, warningSubject, DAY_MS }
