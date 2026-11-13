/// <reference path="../pb_data/types.d.ts" />
// Enforces the security log's retention (design 6.9): every day at 03:00 UTC,
// entries older than system_behavior.security_retention_days are removed.

cronAdd("purge_security_events", "0 3 * * *", () => {
  // Hook handlers run in isolated scopes, so helpers are loaded inside the handler.
  const { getSystemBehavior } = require(`${__hooks}/lib/settings.js`)
  const { cutoffIso } = require(`${__hooks}/lib/retention.js`)

  // Read at run time, so a changed setting applies at the next run.
  const cutoff = cutoffIso(Date.now(), getSystemBehavior($app).securityRetentionDays)

  // Deletes in batches, so a large backlog is never loaded into memory at once.
  for (;;) {
    const expired = $app.findRecordsByFilter("security_events", "created < {:cutoff}", "", 500, 0, { cutoff: cutoff })
    if (expired.length === 0) {
      break
    }
    for (const record of expired) {
      $app.delete(record)
    }
  }
})
