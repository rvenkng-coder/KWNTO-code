// Reads and writes behind the invite routes (teams-invites.pb.js, design section 5).
// Here rather than in the route file because hook handlers run in isolated scopes, and
// the three routes share these steps. Every value from a request is a bound parameter.
// CommonJS so hooks can load it with require(`${__hooks}/lib/team-invites.js`).
// Uses the PocketBase app and the global Record, so it is checked by the rule tests.

// The users account `typed` (trimmed, case as typed; lib/invite-email.js) names, or
// null. PocketBase 0.40.6 stores an address as it was typed at sign-up and
// app.findAuthRecordByEmail compares case-sensitively (it missed an account stored as
// "Mixed-...@Example.TEST"; findings.md, Task 8), so the lookup ignores case on both
// sides. Accounts may differ only in case, so up to two matches are read and
// chooseAccountIndex picks one by a fixed rule, or none. The email is a bound parameter.
function findUserByEmail(app, typed) {
  const { chooseAccountIndex } = require(`${__hooks}/lib/invite-email.js`)

  if (typed === "") {
    return null
  }
  const rows = app.findRecordsByFilter("users", "email:lower = {:email}", "", 2, 0, { email: typed.toLowerCase() })
  const index = chooseAccountIndex(rows.map((row) => row.getString("email")), typed)
  return index === -1 ? null : rows[index]
}

function findRecordOrNull(app, collection, id) {
  try {
    return app.findRecordById(collection, id)
  } catch (error) {
    return null
  }
}

function isMember(app, teamId, userId) {
  const rows = app.findRecordsByFilter("team_members", "team = {:team} && user = {:user}", "", 1, 0, { team: teamId, user: userId })
  return rows.length > 0
}

function hasPendingInvite(app, teamId, userId) {
  const filter = "team = {:team} && invited_user = {:user} && status = 'pending'"
  const rows = app.findRecordsByFilter("team_invites", filter, "", 1, 0, { team: teamId, user: userId })
  return rows.length > 0
}

// Makes a pending invite unless the person is already a member or already has a pending
// invite from this team; returns whether it made one. The check and the insert share a
// transaction, and PocketBase runs write transactions one at a time, so two invites sent
// at once cannot both insert (the partial unique index on pending invites backs this).
// The names are copied in by the team_invites create hook (teams-invites.pb.js).
function createInvite(app, teamId, inviteeId, inviterId) {
  let created = false
  app.runInTransaction((txApp) => {
    if (isMember(txApp, teamId, inviteeId) || hasPendingInvite(txApp, teamId, inviteeId)) {
      return
    }
    const invite = new Record(txApp.findCollectionByNameOrId("team_invites"))
    invite.set("team", teamId)
    invite.set("invited_user", inviteeId)
    invite.set("invited_by", inviterId)
    invite.set("status", "pending")
    txApp.save(invite)
    created = true
  })
  return created
}

// The invite with this id if it was sent to this user, else null: someone else's
// invite and an id that does not exist look the same.
function findOwnInvite(app, inviteId, userId) {
  const rows = app.findRecordsByFilter("team_invites", "id = {:id} && invited_user = {:user}", "", 1, 0, { id: inviteId, user: userId })
  return rows.length > 0 ? rows[0] : null
}

// Answers a pending invite with `status` ("accepted" or "declined"); an accepted one
// also makes the person a plain member, unless they already are (for example by join
// code). Returns false if the invite was already answered. The status change and the
// member row are one transaction: neither exists without the other, and two accepts
// sent at once cannot both see "pending". The member row is saved as a normal record,
// so the team_members hook fills `user_name` (teams.pb.js, D6).
function answerInvite(app, inviteId, status) {
  let answered = false
  app.runInTransaction((txApp) => {
    const invite = txApp.findRecordById("team_invites", inviteId)
    if (invite.getString("status") !== "pending") {
      return
    }
    invite.set("status", status)
    txApp.save(invite)
    const teamId = invite.getString("team")
    const userId = invite.getString("invited_user")
    if (status === "accepted" && !isMember(txApp, teamId, userId)) {
      const row = new Record(txApp.findCollectionByNameOrId("team_members"))
      row.set("team", teamId)
      row.set("user", userId)
      row.set("role", "member")
      txApp.save(row)
    }
    answered = true
  })
  return answered
}

module.exports = { findUserByEmail, findRecordOrNull, isMember, createInvite, findOwnInvite, answerInvite }
