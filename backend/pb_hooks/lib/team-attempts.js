// The per-user limit on join-code and invite attempts (design 5, docs/security.md
// section 3; setting `team_attempts_per_hour`, decision D3). Both routes share one
// limit, so they must count the same way: moved here from teams-join.pb.js in Task 8,
// because hook handlers run in isolated scopes and the invite route could not reach the
// join route's helpers. The logic is unchanged.
// CommonJS so hooks can load it with require(`${__hooks}/lib/team-attempts.js`).
// Reads the security log through the app, so it is checked by the rule tests; the pure
// decision is isOverLimit (lib/rate-limit.js, unit tested).

const HOUR_MS = 60 * 60 * 1000

// True when the user has used up their attempts for the hour, so the attempt being
// made now must be refused with 429.
function teamAttemptLimitReached(app, userId) {
  const { getSystemBehavior } = require(`${__hooks}/lib/settings.js`)
  const { isOverLimit } = require(`${__hooks}/lib/rate-limit.js`)

  const nowMs = Date.now()
  const limit = getSystemBehavior(app).teamAttemptsPerHour
  return isOverLimit(countedAttemptTimesMs(app, userId, nowMs - HOUR_MS), nowMs, HOUR_MS, limit)
}

// The times (ms) of the user's join and invite attempts since `sinceMs` that count
// toward the limit. Refusals by the limit itself are logged with `detail.limited` and
// do not count, so hammering a route does not extend the limit: it ends an hour after
// the attempts that caused it (like the sign-in lockout).
function countedAttemptTimesMs(app, userId, sinceMs) {
  const rows = app.findRecordsByFilter(
    "security_events",
    "user = {:user} && (type = 'join' || type = 'invite') && created > {:since} && detail.limited != true",
    "",
    0,
    0,
    { user: userId, since: storedDateTime(sinceMs) },
  )
  return rows.map((record) => record.getDateTime("created").time().unixMilli())
}

// The datetime text PocketBase stores ("2026-11-12 08:30:00.000Z"); the filter compares
// text, so the ISO "T" separator would sort wrongly (as in users-signin.pb.js).
function storedDateTime(ms) {
  return new Date(ms).toISOString().replace("T", " ")
}

module.exports = { teamAttemptLimitReached }
