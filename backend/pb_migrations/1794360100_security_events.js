/// <reference path="../pb_data/types.d.ts" />
// Creates the admin-only security log (design 6.9, docs/security.md section 8).
// Entries are written by server hooks through lib/security-log.js, never by clients,
// so every rule stays null. Never edit this file after it has run; add a new migration.
migrate((app) => {
  const users = app.findCollectionByNameOrId("users")
  const collection = new Collection({
    type: "base",
    name: "security_events",
    listRule: null,
    viewRule: null,
    createRule: null,
    updateRule: null,
    deleteRule: null,
    fields: [
      {
        name: "type",
        type: "select",
        required: true,
        maxSelect: 1,
        // Decision D4 of the accounts and teams plan.
        values: ["signup", "verification", "sign-in", "failure", "lockout", "reset", "invite", "join", "admin"],
      },
      // Optional, and no cascade delete: deleting an account must not erase its history.
      { name: "user", type: "relation", collectionId: users.id, maxSelect: 1, cascadeDelete: false },
      { name: "ip", type: "text", max: 64 },
      { name: "detail", type: "json", maxSize: 10000 },
      { name: "created", type: "autodate", onCreate: true, onUpdate: false },
    ],
    // Lockout counts recent failures by type and time; the retention purge filters by time.
    indexes: ["CREATE INDEX idx_security_events_type_created ON security_events (type, created)"],
  })
  app.save(collection)
}, (app) => {
  app.delete(app.findCollectionByNameOrId("security_events"))
})
