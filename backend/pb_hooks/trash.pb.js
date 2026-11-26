/// <reference path="../pb_data/types.d.ts" />
// Enforces the trash retention (design 6.8): every night at 03:30 UTC, projects,
// then chapters, then nodes trashed longer ago than system_behavior.trash_retention_days
// are deleted for good. PocketBase's cascades remove what hangs on them (lines, cues,
// choices, media rows and their files); a choice pointing at a purged node becomes empty
// and a purged start node empties the project's start (migration 1794370200).

cronAdd("purge_trash", "30 3 * * *", () => {
  // Hook handlers run in isolated scopes, so helpers are loaded inside the handler.
  const { getSystemBehavior } = require(`${__hooks}/lib/settings.js`)
  const { cutoffIso } = require(`${__hooks}/lib/retention.js`)

  // Read at run time, so a changed setting applies at the next run.
  const cutoff = cutoffIso(Date.now(), getSystemBehavior($app).trashRetentionDays)
  const filter = "deleted_at != '' && deleted_at < {:cutoff}"
  const { purgeInBatches, withoutSkipped } = require(`${__hooks}/lib/purge.js`)

  // In this order, so a trashed project goes before its own trashed chapters and nodes are
  // looked at. Deletes in batches, so a large backlog is never loaded into memory at once. A
  // record that cannot be deleted is logged and skipped, so it cannot stall the rest every night.
  for (const name of ["projects", "chapters", "nodes"]) {
    purgeInBatches(
      (skipIds) => {
        const params = { cutoff: cutoff }
        return $app.findRecordsByFilter(name, withoutSkipped(filter, skipIds, params), "", 200, 0, params)
      },
      (record) => $app.delete(record),
      (record, error) =>
        $app
          .logger()
          .error("purge_trash: could not delete a record", "collection", name, "id", record.id, "error", String(error)),
    )
  }
})
