/// <reference path="../pb_data/types.d.ts" />
// The two settings the browser needs: `system_behavior` itself stays admin only,
// so this route copies out just the trash retention (for "<n> days left") and the presence
// timeout. Any signed-in person may read it, verified or not.

routerAdd(
  "GET",
  "/api/kwnto/app-settings",
  (e) => {
    const { getSystemBehavior } = require(`${__hooks}/lib/settings.js`)
    const behavior = getSystemBehavior(e.app)
    return e.json(200, {
      trashRetentionDays: behavior.trashRetentionDays,
      presenceTimeoutSeconds: behavior.presenceTimeoutSeconds,
    })
  },
  $apis.requireAuth("users"),
)
