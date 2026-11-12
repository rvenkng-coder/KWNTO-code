/// <reference path="../pb_data/types.d.ts" />
// Sign-up, the verified flag and the password rules (design 7c, docs/security.md
// section 3). The password rules run on every request that sets a password: sign-up,
// password change and password reset. The admin (superuser) is exempt from the
// registration switch, the verified flag and the private-email flag, so the admin can
// always add an account, but not from the password rules.
//
// Each handler logs after e.next() has succeeded, so a refused request leaves no entry.
// It logs with e.app, not $app: inside a batch or transaction, $app would wait on the
// database lock the transaction holds.

onRecordCreateRequest((e) => {
  // Hook handlers run in isolated scopes, so helpers are loaded inside the handler.
  const { getSystemAccess } = require(`${__hooks}/lib/settings.js`)
  const { checkPassword } = require(`${__hooks}/lib/password-rules.js`)
  const { logEvent } = require(`${__hooks}/lib/security-log.js`)

  const isAdmin = e.hasSuperuserAuth()
  if (!isAdmin) {
    if (!getSystemAccess(e.app).registrationOpen) {
      throw new ApiError(403, "Sign-up is closed.")
    }
    // A visitor must prove the email address; never trust a verified flag they send.
    // (PocketBase 0.40.6 already refuses one; this keeps it so if that ever changes.)
    e.record.setVerified(false)
    // Emails are private to everyone but the admin; teammates can see each other's
    // user records, so a visitor may not publish their email there.
    e.record.setEmailVisibility(false)
  }

  const body = e.requestInfo().body
  const problem = checkPassword(String(body.password ?? ""))
  if (problem !== null) {
    throw new ApiError(400, problem, { password: new ValidationError("validation_password_rules", problem) })
  }

  e.next()

  if (!isAdmin) {
    logEvent(e.app, "signup", e.record.id, e.realIP(), {})
  }
}, "users")

onRecordUpdateRequest((e) => {
  const { checkPassword } = require(`${__hooks}/lib/password-rules.js`)

  const body = e.requestInfo().body

  // Emails stay private (see the create hook). Reset rather than refuse, so a form
  // that sends the flag along with a name change still saves the name.
  if (!e.hasSuperuserAuth() && body.emailVisibility !== undefined) {
    e.record.setEmailVisibility(false)
  }

  // Only a request that sets a new password; a name or preference change sends none.
  if (body.password !== undefined) {
    const problem = checkPassword(String(body.password))
    if (problem !== null) {
      throw new ApiError(400, problem, { password: new ValidationError("validation_password_rules", problem) })
    }
  }

  e.next()
}, "users")

onRecordConfirmPasswordResetRequest((e) => {
  const { checkPassword } = require(`${__hooks}/lib/password-rules.js`)
  const { logEvent } = require(`${__hooks}/lib/security-log.js`)

  // PocketBase sets the new password inside e.next(), so it is read from the request.
  const problem = checkPassword(String(e.requestInfo().body.password ?? ""))
  if (problem !== null) {
    throw new ApiError(400, problem, { password: new ValidationError("validation_password_rules", problem) })
  }

  e.next()

  logEvent(e.app, "reset", e.record.id, e.realIP(), {})
}, "users")

onRecordConfirmVerificationRequest((e) => {
  const { logEvent } = require(`${__hooks}/lib/security-log.js`)

  // A link can be opened twice; only the first confirmation is a verification.
  const wasVerified = e.record.verified()

  e.next()

  if (!wasVerified) {
    logEvent(e.app, "verification", e.record.id, e.realIP(), {})
  }
}, "users")
