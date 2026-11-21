// The per-user limit on project imports (whole-branch review finding M2 of plan
// 2026-11-20-sharing; docs/security.md "Bad imports"). One import can hold the database's only
// write connection for several seconds, so a person may start only IMPORTS_PER_HOUR of them
// an hour. Every accepted attempt is written to the security log as `import`; a refusal by
// this limit is not, so hammering the route does not extend the wait (as with join codes).
// CommonJS so hooks can load it with require(`${__hooks}/lib/import-limit.js`).

const HOUR_MS = 60 * 60 * 1000
const IMPORTS_PER_HOUR = 10

// True when the user has used up their imports for the hour.
function importLimitReached(app, userId) {
  const { isOverLimit } = require(`${__hooks}/lib/rate-limit.js`)
  const nowMs = Date.now()
  const since = new Date(nowMs - HOUR_MS).toISOString().replace("T", " ")
  const rows = app.findRecordsByFilter("security_events", "user = {:user} && type = 'import' && created > {:since}", "", 0, 0, {
    user: userId,
    since: since,
  })
  const times = rows.map((record) => record.getDateTime("created").time().unixMilli())
  return isOverLimit(times, nowMs, HOUR_MS, IMPORTS_PER_HOUR)
}

module.exports = { importLimitReached, IMPORTS_PER_HOUR }
