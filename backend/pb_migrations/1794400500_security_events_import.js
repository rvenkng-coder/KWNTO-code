/// <reference path="../pb_data/types.d.ts" />
// Adds the `import` type to the security log (plan 2026-11-20-sharing, whole-branch review
// finding M2): every project import attempt is logged, and the import route counts them to
// limit one person to a few an hour (pb_hooks/lib/import-limit.js). The down migration puts
// the old list back. Never edit this file after it has run.

const BEFORE = ["signup", "verification", "sign-in", "failure", "lockout", "reset", "invite", "join", "admin"]

function setTypes(app, values) {
  const events = app.findCollectionByNameOrId("security_events")
  events.fields.getByName("type").values = values
  app.save(events)
}

migrate((app) => setTypes(app, [...BEFORE, "import"]), (app) => setTypes(app, BEFORE))
