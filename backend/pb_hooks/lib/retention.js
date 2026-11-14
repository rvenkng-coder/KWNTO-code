// Retention cut-offs for scheduled purges (design 6.9: retention is an admin setting).
// CommonJS so hooks can load it with require(`${__hooks}/lib/retention.js`).

const DAY_MS = 24 * 60 * 60 * 1000

// Returns the moment `days` before `nowMs` as PocketBase datetime text
// ("YYYY-MM-DD HH:mm:ss.SSSZ", always UTC), so it compares correctly with stored dates.
// Days are fixed 24-hour spans: the time is UTC, which has no daylight-saving shifts.
function cutoffIso(nowMs, days) {
  const iso = new Date(nowMs - days * DAY_MS).toISOString() // "YYYY-MM-DDTHH:mm:ss.SSSZ"
  return iso.replace("T", " ")
}

module.exports = { cutoffIso }
