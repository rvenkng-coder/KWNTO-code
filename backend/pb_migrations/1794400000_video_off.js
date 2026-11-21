/// <reference path="../pb_data/types.d.ts" />
// Video uploads off (plan 2026-11-21-node-links, D1). A 150 MB upload did not finish through
// Tailscale Funnel, so writers link a video instead. Removes mov and mp4 from the allowed types;
// the admin can add them back in the dashboard. 1794360000 is never edited, so a fresh install
// runs both and starts with video off.

const ALL_TYPES = ["wav", "mp3", "mov", "mp4", "jpeg", "png"]
const VIDEO_TYPES = ["mov", "mp4"]

migrate((app) => {
  const row = app.findFirstRecordByFilter("system_storage", "id != ''")
  const allowed = row.getStringSlice("allowed_types").filter((t) => !VIDEO_TYPES.includes(t))
  row.set("allowed_types", allowed)
  app.save(row)
}, (app) => {
  const row = app.findFirstRecordByFilter("system_storage", "id != ''")
  const allowed = row.getStringSlice("allowed_types")
  const restored = ALL_TYPES.filter((t) => allowed.includes(t) || VIDEO_TYPES.includes(t))
  row.set("allowed_types", restored)
  app.save(row)
})
