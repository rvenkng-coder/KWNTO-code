/// <reference path="../pb_data/types.d.ts" />
// Presence (plan 7 Task 6, D14): the name is copied from the account when a row is made, and a
// job removes rows nobody refreshes any more (a closed tab or a lost connection).

onRecordCreate((e) => {
  const user = e.app.findRecordById("users", e.record.getString("user"))
  const name = user.getString("name").trim()
  e.record.set("user_name", name === "" ? "Someone" : name)
  e.next()
}, "presence")

cronAdd("purge_presence", "* * * * *", () => {
  // Hook handlers run in isolated scopes, so helpers are loaded inside the handler.
  const { getSystemBehavior } = require(`${__hooks}/lib/settings.js`)
  const { staleCutoffIso } = require(`${__hooks}/lib/presence.js`)

  // The timeout is read at run time, so a changed setting applies at the next run.
  const cutoff = staleCutoffIso(Date.now(), getSystemBehavior($app).presenceTimeoutSeconds)
  for (;;) {
    const stale = $app.findRecordsByFilter("presence", "updated < {:cutoff}", "", 200, 0, { cutoff: cutoff })
    if (stale.length === 0) {
      break
    }
    for (const row of stale) {
      $app.delete(row)
    }
  }
})
