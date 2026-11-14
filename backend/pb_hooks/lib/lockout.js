// Decides whether one account is locked out from one IP (design 7c, decision D2).
// CommonJS so hooks can load it with require(`${__hooks}/lib/lockout.js`).
// Pure: the hook (users-signin.pb.js) chooses which failures belong to the pair and
// passes their times, so this can be unit tested without PocketBase.

// failureTimesMs: times (ms since epoch) of the failed sign-ins of ONE account from ONE
// IP since that pair's last successful sign-in, in any order. Locked when at least
// maxFailed of them fall in the last lockoutMinutes.
// Returns { locked, retryAfterSeconds }: retryAfterSeconds is 0 when not locked, else
// the whole seconds (rounded up) until the maxFailed-th most recent failure leaves the
// window, which is when fewer than maxFailed remain and the lockout ends by itself.
// A setting of 0 for either number turns the lockout off: 0 minutes is an empty window,
// and a limit of 0 would otherwise lock every account before its first attempt.
function decideLockout(failureTimesMs, nowMs, maxFailed, lockoutMinutes) {
  const notLocked = { locked: false, retryAfterSeconds: 0 }
  if (maxFailed < 1 || lockoutMinutes <= 0) {
    return notLocked
  }

  const windowMs = lockoutMinutes * 60 * 1000
  const windowStartMs = nowMs - windowMs
  const recentNewestFirst = failureTimesMs
    .filter((time) => time > windowStartMs)
    .sort((a, b) => b - a)
  if (recentNewestFirst.length < maxFailed) {
    return notLocked
  }

  const deciding = recentNewestFirst[maxFailed - 1]
  const remainingMs = deciding + windowMs - nowMs
  return { locked: true, retryAfterSeconds: Math.ceil(remainingMs / 1000) }
}

module.exports = { decideLockout }
