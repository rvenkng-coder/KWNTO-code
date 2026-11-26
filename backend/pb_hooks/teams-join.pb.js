/// <reference path="../pb_data/types.d.ts" />
// Joining a team by code, and the owner's control over the code (design section 5,
// docs/security.md sections 2 and 3). Routes, because team_members has no create rule:
// a member row is only ever made by the server, after these checks.
//
// What a caller can learn is kept small on purpose:
// - a wrong, disabled or never-issued code all get the same 404 and message, so a
//   guesser cannot tell a real code from nonsense;
// - a successful join answers the team's id and name only;
// - the code is never written to the security log (anyone reading it could join).
// A join code has about 40 bits, so it is guessable in principle; the per-user limit
// (`team_attempts_per_hour`, shared with invites, decision D3) keeps guessing slow.

routerAdd(
  "POST",
  "/api/kwnto/teams/join",
  (e) => {
    // Hook handlers run in isolated scopes, so helpers are loaded inside the handler.
    // The attempt counting moved to lib/team-attempts.js in Task 8, unchanged, so the
    // invite route counts the shared limit (D3) exactly the same way.
    const { teamAttemptLimitReached } = require(`${__hooks}/lib/team-attempts.js`)
    const { logEvent } = require(`${__hooks}/lib/security-log.js`)

    if (!e.auth.verified()) {
      throw new ForbiddenError("Verify your email address first.")
    }
    const userId = e.auth.id
    const ip = e.realIP()

    if (teamAttemptLimitReached(e.app, userId)) {
      // Logged so the admin sees the guessing, but marked `limited` and left out of the
      // count, so hammering the route does not extend the limit: it ends an hour after
      // the attempts that caused it (like the sign-in lockout, docs/security.md section 3).
      logEvent(e.app, "join", userId, ip, { ok: false, limited: true })
      throw new ApiError(429, "Too many attempts. Try again later.")
    }

    const settings = enabledSettingsFor(e.app, normalisedCode(e.requestInfo().body.code))
    if (settings === null) {
      logEvent(e.app, "join", userId, ip, { ok: false })
      throw new NotFoundError("That join code is not valid.")
    }

    const teamId = settings.getString("team")
    try {
      addMember(e.app, teamId, userId)
    } catch (error) {
      // Still an attempt, so it counts toward the limit.
      logEvent(e.app, "join", userId, ip, { ok: false })
      throw error
    }
    logEvent(e.app, "join", userId, ip, { ok: true, team: teamId })

    const team = e.app.findRecordById("teams", teamId)
    return e.json(200, { team: teamId, name: team.getString("name") })

    // Codes are read off a projector and typed by hand: case and stray spaces do not
    // matter. Anything that is not a string (a missing body, a number) matches no team.
    function normalisedCode(code) {
      return typeof code === "string" ? code.trim().toUpperCase() : ""
    }

    // The settings row whose code is `code` and switched on, or null. The code is a bound
    // parameter, never part of the filter text, so it cannot change the query.
    function enabledSettingsFor(app, code) {
      if (code === "") {
        return null
      }
      const rows = app.findRecordsByFilter(
        "team_settings",
        "join_code = {:code} && join_code_enabled = true",
        "",
        1,
        0,
        { code },
      )
      return rows.length > 0 ? rows[0] : null
    }

    // Joining twice is not an error: an existing row is kept and nothing is added. The
    // check and the insert run in one transaction, and PocketBase runs write transactions
    // one at a time, so two simultaneous joins by one user cannot both insert. If an
    // insert still fails, the unique index on (team, user) may have refused a duplicate
    // made some other way; that is a success if the row now exists.
    // The row is saved as a normal record, so the teams hook fills `user_name` (D6).
    function addMember(app, teamId, userId) {
      try {
        app.runInTransaction((txApp) => {
          if (membershipExists(txApp, teamId, userId)) {
            return
          }
          const row = new Record(txApp.findCollectionByNameOrId("team_members"))
          row.set("team", teamId)
          row.set("user", userId)
          row.set("role", "member")
          txApp.save(row)
        })
      } catch (error) {
        if (!membershipExists(app, teamId, userId)) {
          throw error
        }
      }
    }

    function membershipExists(app, teamId, userId) {
      const rows = app.findRecordsByFilter("team_members", "team = {:team} && user = {:user}", "", 1, 0, {
        team: teamId,
        user: userId,
      })
      return rows.length > 0
    }
  },
  $apis.requireAuth("users"),
)

// Only the owner regenerates the code (security.md section 2), for example after it
// leaked: the old code stops working at once. Anyone outside the team, the owner of
// another team included, gets the same 404 as for a team that does not exist, so the
// route does not reveal which team ids exist; a plain member, who can see the team
// anyway, is told it is the owner's job.
routerAdd(
  "POST",
  "/api/kwnto/teams/{id}/regenerate-code",
  (e) => {
    const { unusedJoinCode } = require(`${__hooks}/lib/unused-join-code.js`)

    if (!e.auth.verified()) {
      throw new ForbiddenError("Verify your email address first.")
    }
    const teamId = e.request.pathValue("id")
    const membership = e.app.findRecordsByFilter("team_members", "team = {:team} && user = {:user}", "", 1, 0, {
      team: teamId,
      user: e.auth.id,
    })
    if (membership.length === 0) {
      throw new NotFoundError("No team with this id.")
    }
    const team = e.app.findRecordById("teams", teamId)
    if (team.getString("owner") !== e.auth.id) {
      throw new ForbiddenError("Only the team owner can change the join code.")
    }

    const settings = e.app.findFirstRecordByFilter("team_settings", "team = {:team}", { team: teamId })
    const code = unusedJoinCode(e.app)
    settings.set("join_code", code)
    e.app.save(settings)
    return e.json(200, { join_code: code })
  },
  $apis.requireAuth("users"),
)
