// The per-user limit on join-code and invite attempts (design 5, docs/security.md
// section 3; setting `team_attempts_per_hour`, decision D3).
// CommonJS so hooks can load it with require(`${__hooks}/lib/rate-limit.js`).
// Pure: the hook chooses which attempts count and passes their times.

// timesMs: times (ms since epoch) of one user's counted attempts, in any order.
// True when at least `max` of them fall within the last windowMs, so the attempt being
// made now would be one too many. A max of 0 refuses every attempt.
function isOverLimit(timesMs, nowMs, windowMs, max) {
  const windowStartMs = nowMs - windowMs
  const inWindow = timesMs.filter((time) => time > windowStartMs)
  return inWindow.length >= max
}

module.exports = { isOverLimit }
