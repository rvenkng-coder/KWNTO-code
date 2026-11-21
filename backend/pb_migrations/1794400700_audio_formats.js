/// <reference path="../pb_data/types.d.ts" />
// Three more audio formats: ogg, m4a and opus. Adds them to the allowed types of an existing
// install (1794360000 is never edited, so a fresh install runs it and then this). Whatever the
// admin has switched off stays off; only the three new types are added.

const ORDER = ["wav", "mp3", "ogg", "m4a", "opus", "mov", "mp4", "jpeg", "png"]
const NEW_TYPES = ["ogg", "m4a", "opus"]

migrate((app) => {
  const row = app.findFirstRecordByFilter("system_storage", "id != ''")
  const allowed = row.getStringSlice("allowed_types")
  row.set("allowed_types", ORDER.filter((t) => allowed.includes(t) || NEW_TYPES.includes(t)))
  app.save(row)
}, (app) => {
  const row = app.findFirstRecordByFilter("system_storage", "id != ''")
  const allowed = row.getStringSlice("allowed_types")
  row.set("allowed_types", allowed.filter((t) => !NEW_TYPES.includes(t)))
  app.save(row)
})
