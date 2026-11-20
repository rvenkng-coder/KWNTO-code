/// <reference path="../pb_data/types.d.ts" />
// Teams (design section 5): a new team gets its owner's membership row and its settings
// row; membership rows carry a copy of the member's name (decision D6), kept in step
// when the name changes. Model hooks, so they hold for every way a record is made: the
// API, the admin dashboard and server code (Tasks 7 and 8 add members from routes).

// The team's own insert (e.next()) must stay outside a transaction of ours: with the insert
// moved into one (e.app = txApp), PocketBase 0.40.6 sends no realtime create event for the
// team, so the creator's open list never updates (plan 7 Task 7; the same finding as the nodes
// hook in projects.pb.js). So the team is inserted first, and its owner row and settings row
// are saved together in a transaction of their own. If that fails, the team is deleted again
// and the error goes on, so no team is left without them.
onRecordCreate((e) => {
  // Shared with the regenerate route (teams-join.pb.js) since Task 7, so both pick codes
  // the same way; the logic itself is unchanged.
  const { unusedJoinCode } = require(`${__hooks}/lib/unused-join-code.js`)

  e.next()
  try {
    e.app.runInTransaction((txApp) => {
      const ownerRow = new Record(txApp.findCollectionByNameOrId("team_members"))
      ownerRow.set("team", e.record.id)
      ownerRow.set("user", e.record.getString("owner"))
      ownerRow.set("role", "owner")
      txApp.save(ownerRow)

      const settings = new Record(txApp.findCollectionByNameOrId("team_settings"))
      settings.set("team", e.record.id)
      settings.set("join_code", unusedJoinCode(txApp))
      settings.set("join_code_enabled", false) // decision D1: off until the owner turns it on
      txApp.save(settings)
    })
  } catch (err) {
    e.app.delete(e.record)
    throw err
  }
}, "teams")

// Every membership row gets the member's current name from the server, whatever the
// caller sent: teammates read names here because users records are private.
onRecordCreate((e) => {
  const user = e.app.findRecordById("users", e.record.getString("user"))
  e.record.set("user_name", user.getString("name"))
  e.next()
}, "team_members")

// A renamed user's membership rows follow (decision D6). The account is already saved,
// so a failure here is logged instead of failing the user's own update; the copy is
// refreshed again on their next rename.
onRecordAfterUpdateSuccess((e) => {
  const name = e.record.getString("name")
  try {
    const stale = e.app.findRecordsByFilter("team_members", "user = {:user} && user_name != {:name}", "", 0, 0, {
      user: e.record.id,
      name,
    })
    for (const row of stale) {
      row.set("user_name", name)
      e.app.save(row)
    }
  } catch (error) {
    console.error(`teams: could not copy the new name of user ${e.record.id} to team_members:`, String(error))
  }
  e.next()
}, "users")
