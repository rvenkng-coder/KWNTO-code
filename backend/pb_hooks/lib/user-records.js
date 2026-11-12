// Makes sure an account has its three per-user rows (design 7c, ERD).
// CommonJS so hooks can load it with require(`${__hooks}/lib/user-records.js`).
// Called when an account is created (users-defaults.pb.js) and again at sign-in
// (Task 4), so an account whose rows are missing is repaired instead of breaking.

// What a new row holds besides its user. user_limits is empty on purpose: no quota
// override means the system default applies.
const DEFAULTS = {
  user_preferences: { theme: "dark", minimap_visible: true },
  user_limits: {},
  user_status: { blocked: false },
}

function hasRow(app, collection, userId) {
  const rows = app.findRecordsByFilter(collection, "user = {:user}", "", 1, 0, { user: userId })
  return rows.length > 0
}

function createRow(app, collection, userId) {
  // Record is the global class the PocketBase hook runtime provides.
  const record = new Record(app.findCollectionByNameOrId(collection))
  record.set("user", userId)
  const defaults = DEFAULTS[collection]
  for (const field of Object.keys(defaults)) {
    record.set(field, defaults[field])
  }
  app.save(record)
}

// Idempotent: creates only the rows that are missing and never changes an existing
// one, so a repeat call cannot undo a user's theme or an admin's block.
function ensureUserRecords(app, userId) {
  for (const collection of Object.keys(DEFAULTS)) {
    if (!hasRow(app, collection, userId)) {
      createRowUnlessRaced(app, collection, userId)
    }
  }
}

// Changed in Task 4: sign-in now calls ensureUserRecords, and two sign-ins of the same
// account at once can both see a row missing and both create it. The second create then
// fails on the unique index on `user`. That is fine, the row exists, so the error is
// swallowed; it is rethrown only if the row is still missing (a real failure).
function createRowUnlessRaced(app, collection, userId) {
  try {
    createRow(app, collection, userId)
  } catch (error) {
    if (!hasRow(app, collection, userId)) {
      throw error
    }
  }
}

module.exports = { ensureUserRecords }
