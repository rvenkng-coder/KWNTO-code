/// <reference path="../pb_data/types.d.ts" />
// Makes email addresses case-insensitive (developer decision, 2026-11-13; docs/security.md
// section 3). PocketBase's own unique index on `users.email` is case-sensitive, so
// `Dup@x.test` and `dup@x.test` could both register, and a look-alike account could
// capture someone's invites. This lower-cases every stored address and adds a unique
// index on LOWER(email), so the database refuses a case variant on every path (sign-up,
// admin dashboard, email change). The users-signup hook lower-cases new addresses too.
// If two existing accounts differ only in case, this stops with their addresses so the
// admin can decide which to keep; nothing is merged or deleted automatically.
// Never edit this file after it has run.
migrate((app) => {
  const users = app.findAllRecords("users")
  const seen = {}
  for (const user of users) {
    const email = String(user.email())
    const key = email.toLowerCase()
    if (key !== "" && seen[key] !== undefined) {
      throw new Error(`Cannot make emails case-insensitive: "${seen[key]}" and "${email}" differ only in case. Rename or remove one, then run again.`)
    }
    seen[key] = email
  }
  for (const user of users) {
    const email = String(user.email())
    if (email !== email.toLowerCase()) {
      user.setEmail(email.toLowerCase())
      app.save(user)
    }
  }
  const collection = app.findCollectionByNameOrId("users")
  collection.indexes.push("CREATE UNIQUE INDEX idx_users_email_nocase ON users (LOWER(email)) WHERE email != ''")
  app.save(collection)
}, (app) => {
  const collection = app.findCollectionByNameOrId("users")
  collection.indexes = collection.indexes.filter((sql) => !sql.includes("idx_users_email_nocase"))
  app.save(collection)
})
