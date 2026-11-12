/// <reference path="../pb_data/types.d.ts" />
// Teams (design section 5): a new team gets its owner's membership row and its settings
// row; membership rows carry a copy of the member's name (decision D6), kept in step
// when the name changes. Model hooks, so they hold for every way a record is made: the
// API, the admin dashboard and server code (Tasks 7 and 8 add members from routes).

// A team, its owner row and its settings row are saved in one transaction, so no team
// can exist without them. PocketBase 0.40.6 does not wrap a record create in a
// transaction, and onRecordAfterCreateSuccess runs after the team is already stored
// (findings.md, Task 6), so the transaction is opened here and the team's own insert
// (e.next()) is moved into it by pointing the event at the transaction's app.
onRecordCreate((e) => {
  const { generateJoinCode, JOIN_CODE_ALPHABET } = require(`${__hooks}/lib/join-code.js`)

  // Crypto-quality randomness: $security draws each character with crypto/rand, and one
  // character from n distinct symbols is a uniform index in [0, n).
  const randomIndex = (n) => {
    if (n > JOIN_CODE_ALPHABET.length) {
      throw new Error(`randomIndex supports at most ${JOIN_CODE_ALPHABET.length} values`)
    }
    const symbols = JOIN_CODE_ALPHABET.slice(0, n)
    return symbols.indexOf($security.randomStringWithAlphabet(1, symbols))
  }

  // A clash is very unlikely (32^8 codes), but the code must be unique because joining
  // looks the team up by it; give up after 5 tries rather than loop.
  const unusedJoinCode = (txApp) => {
    for (let attempt = 0; attempt < 5; attempt++) {
      const code = generateJoinCode(randomIndex)
      const clashes = txApp.findRecordsByFilter("team_settings", "join_code = {:code}", "", 1, 0, { code })
      if (clashes.length === 0) {
        return code
      }
    }
    throw new Error("could not find an unused join code in 5 attempts")
  }

  e.app.runInTransaction((txApp) => {
    e.app = txApp
    e.next()

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
