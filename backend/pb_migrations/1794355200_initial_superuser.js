/// <reference path="../pb_data/types.d.ts" />
// Creates the first admin from the environment. PocketBase runs a migration once per
// data folder, so a later restart never overwrites a password changed in the dashboard.
// Never edit this file after it has run; a change needs a new migration.
migrate((app) => {
  const superusers = app.findCollectionByNameOrId("_superusers")
  const record = new Record(superusers)
  record.set("email", $os.getenv("KWNTO_ADMIN_EMAIL"))
  record.set("password", $os.getenv("KWNTO_ADMIN_PASSWORD"))
  app.save(record)
}, (app) => {
  try {
    const record = app.findAuthRecordByEmail("_superusers", $os.getenv("KWNTO_ADMIN_EMAIL"))
    app.delete(record)
  } catch (_) {
    // already gone
  }
})
