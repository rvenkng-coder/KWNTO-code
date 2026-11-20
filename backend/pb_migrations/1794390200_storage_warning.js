/// <reference path="../pb_data/types.d.ts" />
// The disk-usage warning (design 7c, plan 6 D12): the total, in bytes, above which the
// admin is warned (default 20 GB; 0 turns the warning off), and the `storage` log type.
// The default is written once, only where the field is empty, so a value the admin
// changed is never overwritten. Never edit this file after it has run; add a new one.

const DEFAULT_WARNING_BYTES = 21474836480 // 20 GB

migrate((app) => {
  const storage = app.findCollectionByNameOrId("system_storage")
  storage.fields.add(new NumberField({ name: "total_warning_bytes", onlyInt: true, min: 0 }))
  app.save(storage)

  const record = app.findFirstRecordByFilter("system_storage", "id != ''")
  if (record.getInt("total_warning_bytes") === 0) {
    record.set("total_warning_bytes", DEFAULT_WARNING_BYTES)
    app.save(record)
  }

  const events = app.findCollectionByNameOrId("security_events")
  const type = events.fields.getByName("type")
  type.values = [...type.values, "storage"]
  app.save(events)
}, (app) => {
  app.db().newQuery("DELETE FROM security_events WHERE type = 'storage'").execute()
  const events = app.findCollectionByNameOrId("security_events")
  const type = events.fields.getByName("type")
  type.values = type.values.filter((value) => value !== "storage")
  app.save(events)

  const storage = app.findCollectionByNameOrId("system_storage")
  storage.fields.removeByName("total_warning_bytes")
  app.save(storage)
})
