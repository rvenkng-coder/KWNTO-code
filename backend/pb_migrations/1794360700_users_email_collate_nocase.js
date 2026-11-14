/// <reference path="../pb_data/types.d.ts" />
// Replaces the LOWER(email) index of 1794360600 with PocketBase's own email index made
// case-insensitive (`COLLATE NOCASE`). Final whole-branch review, I2: PocketBase 0.40.6
// looks an account up by email (password reset, verification request, email-change
// uniqueness, sign-in) case-insensitively only when the email unique index says
// COLLATE NOCASE; an expression index on LOWER(email) does not count, so a reset
// requested with a capital answered 204 and sent no mail. With this index every lookup
// ignores case and a case variant is still refused. Stored addresses are already
// lower-case (1794360600); the users-signup hook keeps lower-casing new ones.
// Never edit this file after it has run.
migrate((app) => {
  const users = app.findCollectionByNameOrId("users")
  const kept = []
  for (const sql of users.indexes) {
    if (sql.includes("idx_users_email_nocase")) {
      continue
    }
    kept.push(sql.includes("idx_email_") ? sql.replace(/`?email`?(\s*\))/, "`email` COLLATE NOCASE$1") : sql)
  }
  users.indexes = kept
  app.save(users)
}, (app) => {
  const users = app.findCollectionByNameOrId("users")
  const restored = users.indexes.map((sql) => sql.replace(" COLLATE NOCASE", ""))
  restored.push("CREATE UNIQUE INDEX idx_users_email_nocase ON users (LOWER(email)) WHERE email != ''")
  users.indexes = restored
  app.save(users)
})
