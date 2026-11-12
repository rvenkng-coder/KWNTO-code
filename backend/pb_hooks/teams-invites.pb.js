/// <reference path="../pb_data/types.d.ts" />
// Inviting people to a team by email, and answering invites (design section 5,
// docs/security.md section 3). Routes, because team_invites and team_members have no
// create or update rule: invites and the members they bring are only ever written by
// the server, after these checks. The reads and writes are in lib/team-invites.js.
//
// Emails are private (design 5). What each side can learn is kept small on purpose:
// - the owner learns only whether an account has the email (204, or 404 "That user
//   doesn't exist."): the accepted enumeration risk, slowed by the per-user attempt limit
//   shared with join codes (D3) and recorded by an `invite` log entry per attempt;
// - the owner never gets the invitee's email or id back, and cannot see a pending
//   invite at all (D7); they see the person's name once they have accepted;
// - the log keeps only the email's domain, so it cannot become a list of registered
//   emails;
// - only the invited person can answer an invite; anyone else gets the same 404 as for
//   an invite that does not exist.

// The invitee may not read the team or the inviter's account, so the invite carries
// copies of their names (decision D6), set by the server whatever the caller sent. A
// model hook, so invites made any way (the route, the admin dashboard) get them.
onRecordCreate((e) => {
  const team = e.app.findRecordById("teams", e.record.getString("team"))
  const inviter = e.app.findRecordById("users", e.record.getString("invited_by"))
  e.record.set("team_name", team.getString("name"))
  e.record.set("invited_by_name", inviter.getString("name"))
  e.next()
}, "team_invites")

// Order of checks: signed in (401) and verified (403, neither logged nor counted: they
// cannot invite anyone), then the attempt limit (429), then the team (404 to anyone
// outside it, the owner of another team included, so team ids do not leak; 403 to a
// plain member), then the email (404), then duplicates (409). Every attempt from the
// limit check on is one `invite` log entry, and counts toward the limit.
routerAdd("POST", "/api/kwnto/teams/{id}/invites", (e) => {
  const { teamAttemptLimitReached } = require(`${__hooks}/lib/team-attempts.js`)
  const { normalisedEmail, emailDomain } = require(`${__hooks}/lib/invite-email.js`)
  const { logEvent } = require(`${__hooks}/lib/security-log.js`)
  const { findUserByEmail, findRecordOrNull, isMember, createInvite } = require(`${__hooks}/lib/team-invites.js`)

  if (!e.auth.verified()) {
    throw new ForbiddenError("Verify your email address first.")
  }
  const userId = e.auth.id
  const ip = e.realIP()
  const teamId = e.request.pathValue("id")
  const email = normalisedEmail(e.requestInfo().body.email)
  const team = findRecordOrNull(e.app, "teams", teamId)
  // The team is logged only when it exists, so the log never holds arbitrary path text.
  const attempt = { emailDomain: emailDomain(email), team: team === null ? "" : teamId }
  const log = (outcome) => logEvent(e.app, "invite", userId, ip, Object.assign({}, outcome, attempt))

  if (teamAttemptLimitReached(e.app, userId)) {
    // Marked `limited` and not counted (lib/team-attempts.js), as for join codes.
    log({ ok: false, limited: true })
    throw new ApiError(429, "Too many attempts. Try again later.")
  }
  if (team === null || !isMember(e.app, teamId, userId)) {
    log({ ok: false })
    throw new NotFoundError("No team with this id.")
  }
  if (team.getString("owner") !== userId) {
    log({ ok: false })
    throw new ForbiddenError("Only the team owner can invite people.")
  }

  const invitee = findUserByEmail(e.app, email)
  if (invitee === null) {
    log({ ok: false })
    throw new NotFoundError("That user doesn't exist.")
  }
  let created
  try {
    created = createInvite(e.app, teamId, invitee.id, userId)
  } catch (error) {
    log({ ok: false })
    throw error
  }
  if (!created) {
    log({ ok: false })
    throw new ApiError(409, "That person is already a member or has a pending invite.")
  }
  log({ ok: true })
  return e.noContent(204)
}, $apis.requireAuth("users"))

// Accepting makes the invitee a plain member and answers the team's id and name (the
// same answer as a join by code). Answering is not an attempt on the limit, so it is
// not logged as `invite` (that would count against the invitee's own limit).
routerAdd("POST", "/api/kwnto/invites/{id}/accept", (e) => {
  const { findOwnInvite, answerInvite } = require(`${__hooks}/lib/team-invites.js`)

  // Verified email is required to join a team (design 7c); the invite stays pending.
  if (!e.auth.verified()) {
    throw new ForbiddenError("Verify your email address first.")
  }
  const invite = findOwnInvite(e.app, e.request.pathValue("id"), e.auth.id)
  if (invite === null) {
    throw new NotFoundError("No invite with this id.")
  }
  if (!answerInvite(e.app, invite.id, "accepted")) {
    throw new ApiError(409, "This invite has already been answered.")
  }
  const teamId = invite.getString("team")
  const team = e.app.findRecordById("teams", teamId)
  return e.json(200, { team: teamId, name: team.getString("name") })
}, $apis.requireAuth("users"))

// Declining adds nobody; the owner may invite the person again later.
routerAdd("POST", "/api/kwnto/invites/{id}/decline", (e) => {
  const { findOwnInvite, answerInvite } = require(`${__hooks}/lib/team-invites.js`)

  if (!e.auth.verified()) {
    throw new ForbiddenError("Verify your email address first.")
  }
  const invite = findOwnInvite(e.app, e.request.pathValue("id"), e.auth.id)
  if (invite === null) {
    throw new NotFoundError("No invite with this id.")
  }
  if (!answerInvite(e.app, invite.id, "declined")) {
    throw new ApiError(409, "This invite has already been answered.")
  }
  return e.noContent(204)
}, $apis.requireAuth("users"))
