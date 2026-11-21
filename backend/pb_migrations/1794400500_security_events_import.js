/// <reference path="../pb_data/types.d.ts" />
// Adds the `import` type to the security log (plan 2026-11-20-sharing, whole-branch review
// finding M2): every project import attempt is logged, and the import route counts them to
// limit one person to a few an hour (pb_hooks/lib/import-limit.js). It adds to the list that is
// there (other migrations add their own types, for example `storage`), and the down migration
// removes only `import`. Never edit this file after it has run.

migrate((app) => {
  const events = app.findCollectionByNameOrId("security_events")
  const type = events.fields.getByName("type")
  if (!type.values.includes("import")) type.values = [...type.values, "import"]
  app.save(events)
}, (app) => {
  const events = app.findCollectionByNameOrId("security_events")
  const type = events.fields.getByName("type")
  type.values = type.values.filter((value) => value !== "import")
  app.save(events)
})
