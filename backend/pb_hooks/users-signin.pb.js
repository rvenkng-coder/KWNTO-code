/// <reference path="../pb_data/types.d.ts" />
// Sign-in protection (design 7c, docs/security.md section 3): the system lockdown, the
// lockout after too many failed sign-ins of one account from one IP (decision D2), and
// the account block. Only the `users` collection: the admin (`_superusers`) is never
// locked out, blocked or refused by a lockdown, so the dashboard keeps working.
//
// Every refusal says the same for an email with no account as for a real one; only the
// block reason is personal, and it is shown only after the right password.
// Events are written with e.app, not $app (see docs/developer/backend.md), and logEvent
// never throws, so a logging problem cannot stop a sign-in.

onRecordAuthWithPasswordRequest((e) => {
  // Hook handlers run in isolated scopes, so helpers are loaded inside the handler.
  const { getSystemAccess, getSystemBehavior } = require(`${__hooks}/lib/settings.js`)
  const { decideLockout } = require(`${__hooks}/lib/lockout.js`)
  const { logEvent } = require(`${__hooks}/lib/security-log.js`)

  const access = getSystemAccess(e.app)
  if (access.lockdown) {
    throw new ApiError(403, access.lockdownMessage || "Sign-in is temporarily unavailable.")
  }

  // The email as typed, so an unknown email is counted exactly like a real one, and
  // lower-cased and trimmed so changing the case cannot start a fresh count.
  const identity = String(e.identity).trim().toLowerCase()
  const ip = e.realIP()
  const pair = { identity: identity, ip: ip }
  // PocketBase's own lookup ignores case (the email index is COLLATE NOCASE,
  // 1794360700 migration) but not stray spaces, so an address typed with spaces is
  // looked up again trimmed. Stored addresses are lower-case and unique.
  if (!e.record && identity !== "") {
    const found = e.app.findRecordsByFilter("users", "email = {:email}", "", 1, 0, { email: identity })
    if (found.length > 0) {
      e.record = found[0]
    }
  }
  const userId = e.record ? e.record.id : ""

  const behavior = getSystemBehavior(e.app)
  const nowMs = Date.now()
  const failures = pairFailureTimesMs(e.app, pair, nowMs - behavior.lockoutMinutes * 60 * 1000)
  const lockout = decideLockout(failures, nowMs, behavior.maxFailedLogins, behavior.lockoutMinutes)
  if (lockout.locked) {
    // Logged as `lockout`, never as `failure`, so attempts during a lockout cannot extend it.
    logEvent(e.app, "lockout", userId, ip, { identity: identity })
    const minutes = Math.max(1, Math.ceil(lockout.retryAfterSeconds / 60))
    throw new ApiError(429, `Too many failed sign-in attempts. Try again after ${minutes} minutes.`)
  }

  try {
    e.next()
  } catch (error) {
    // e.next() also fails when the right password meets a refusal after it (the block in
    // onRecordAuthRequest, 403); that is not a guess, so only PocketBase's wrong-credentials
    // answer (400 "Failed to authenticate.", the same for an unknown email) is counted.
    // The status is read from the error rather than checking the password again, which
    // would add a second slow hash only for real accounts and make them easier to spot by
    // response time. The thrown value is a GoError whose `value` is the ApiError.
    const wrongCredentials = Boolean(error && error.value && error.value.status === 400)
    if (wrongCredentials) {
      logEvent(e.app, "failure", userId, ip, { identity: identity })
    }
    throw error
  }

  // Logged here rather than in onRecordAuthRequest, which also runs for token refreshes
  // and does not know the email as typed; this is the pair's reset point for the lockout.
  logEvent(e.app, "sign-in", e.record.id, ip, { identity: identity })

  // The failure times (ms) of one account and IP pair inside the lockout window and after
  // the pair's last successful sign-in (decision D2: a success resets the count).
  function pairFailureTimesMs(app, pair, windowStartMs) {
    const pairFilter = "ip = {:ip} && detail.identity = {:identity}"
    const lastSignIn = app.findRecordsByFilter("security_events", `type = 'sign-in' && ${pairFilter}`, "-created", 1, 0, pair)
    const lastSignInMs = lastSignIn.length > 0 ? createdMs(lastSignIn[0]) : 0
    const sinceMs = Math.max(windowStartMs, lastSignInMs)
    const rows = app.findRecordsByFilter(
      "security_events",
      `type = 'failure' && ${pairFilter} && created > {:since}`,
      "",
      0,
      0,
      { ip: pair.ip, identity: pair.identity, since: storedDateTime(sinceMs) },
    )
    return rows.map(createdMs)
  }

  function createdMs(record) {
    return record.getDateTime("created").time().unixMilli()
  }

  // The datetime text PocketBase stores ("2026-11-12 08:30:00.000Z"); the filter compares
  // text, so the ISO "T" separator would sort wrongly.
  function storedDateTime(ms) {
    return new Date(ms).toISOString().replace("T", " ")
  }
}, "users")

// Runs after the password was accepted, before the session token is sent, and also for
// token refreshes, so a blocked account cannot keep renewing a session either.
onRecordAuthRequest((e) => {
  const { ensureUserRecords } = require(`${__hooks}/lib/user-records.js`)

  // Repair first (Task 2), so an account whose rows went missing still has a status to
  // check. A row that is still missing refuses the sign-in: never assume "not blocked".
  ensureUserRecords(e.app, e.record.id)
  const status = e.app.findRecordsByFilter("user_status", "user = {:user}", "", 1, 0, { user: e.record.id })
  if (status.length === 0) {
    console.error(`sign-in: user ${e.record.id} has no user_status row; sign-in refused`)
    throw new ApiError(500, "Could not check this account. Try again later.")
  }

  if (status[0].getBool("blocked")) {
    const reason = status[0].getString("blocked_reason").trim()
    throw new ApiError(403, reason === "" ? "Your account is blocked." : `Your account is blocked: ${reason}`)
  }

  e.next()
}, "users")
