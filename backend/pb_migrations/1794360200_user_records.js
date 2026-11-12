/// <reference path="../pb_data/types.d.ts" />
// Creates the three per-user tables of design 7c and the ERD, one row per user:
// user_preferences (the user's own choices), user_limits and user_status (the admin's).
// They are separate tables because a user may change their theme but not their own
// quota or block status. Never edit this file after it has run; add a new migration.

// The user-editable table: only its own user may read it, and may change its settings
// but never the user field (a row moved onto another account would give that account two).
const OWN_ROW = "user = @request.auth.id"
const PREFERENCES_RULES = {
  listRule: OWN_ROW,
  viewRule: OWN_ROW,
  createRule: null,
  updateRule: OWN_ROW + " && @request.body.user:isset = false",
  deleteRule: null,
}

// Every rule null: only the admin (superusers) may read or change these.
const ADMIN_ONLY_RULES = { listRule: null, viewRule: null, createRule: null, updateRule: null, deleteRule: null }

const TABLES = [
  {
    name: "user_preferences",
    rules: PREFERENCES_RULES,
    fields: [
      { name: "theme", type: "select", required: true, maxSelect: 1, values: ["light", "dark"] },
      { name: "minimap_visible", type: "bool" },
    ],
    defaults: { theme: "dark", minimap_visible: true },
  },
  {
    name: "user_limits",
    rules: ADMIN_ONLY_RULES,
    // 0 (PocketBase's empty number) means "use system_storage.default_quota_bytes".
    fields: [{ name: "quota_override_bytes", type: "number", onlyInt: true, min: 0 }],
    defaults: {},
  },
  {
    name: "user_status",
    rules: ADMIN_ONLY_RULES,
    fields: [
      { name: "blocked", type: "bool" },
      { name: "blocked_reason", type: "text", max: 500 }, // shown to the blocked user
      { name: "blocked_at", type: "date" },
    ],
    defaults: { blocked: false },
  },
]

// The defaults are repeated here rather than loaded from pb_hooks/lib/user-records.js:
// a migration is a snapshot and must keep doing what it did when it first ran.
function addMissingRow(app, collection, table, userId) {
  const existing = app.findRecordsByFilter(table.name, "user = {:user}", "", 1, 0, { user: userId })
  if (existing.length > 0) {
    return
  }
  const record = new Record(collection)
  record.set("user", userId)
  for (const key of Object.keys(table.defaults)) {
    record.set(key, table.defaults[key])
  }
  app.save(record)
}

migrate((app) => {
  const users = app.findCollectionByNameOrId("users")
  for (const table of TABLES) {
    const collection = new Collection(Object.assign({
      type: "base",
      name: table.name,
      fields: [
        // One row per user (unique index below), removed with the account (cascade).
        { name: "user", type: "relation", required: true, collectionId: users.id, maxSelect: 1, cascadeDelete: true },
      ].concat(table.fields),
      indexes: [`CREATE UNIQUE INDEX idx_${table.name}_user ON ${table.name} (user)`],
    }, table.rules))
    app.save(collection)

    // Accounts made before this migration get their rows now; new ones get them from
    // the users-defaults hook.
    for (const user of app.findAllRecords("users")) {
      addMissingRow(app, collection, table, user.id)
    }
  }
}, (app) => {
  for (const table of TABLES) {
    app.delete(app.findCollectionByNameOrId(table.name))
  }
})
