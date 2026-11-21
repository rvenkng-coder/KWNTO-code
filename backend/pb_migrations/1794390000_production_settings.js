/// <reference path="../pb_data/types.d.ts" />
// Production-only PocketBase settings (plan 6 D6, D7, D8, D10; security.md 3): the rate
// limiter, the trusted proxy header, the app URL and the backup schedule. Runs once per data
// folder, so later edits in the dashboard stay. Does nothing unless KWNTO_PRODUCTION=1, so the
// dev and test backends are untouched. Never edit this file after it has run; add a new migration.
migrate((app) => {
  const { productionSettings } = require(`${__hooks}/lib/production-settings.js`)
  const values = productionSettings({
    KWNTO_PRODUCTION: $os.getenv("KWNTO_PRODUCTION"),
    KWNTO_PUBLIC_URL: $os.getenv("KWNTO_PUBLIC_URL"),
  })
  if (values === null) return

  const settings = app.settings()
  settings.meta.appURL = values.meta.appURL
  settings.meta.appName = values.meta.appName
  settings.rateLimits.enabled = values.rateLimits.enabled
  settings.rateLimits.rules = values.rateLimits.rules
  settings.trustedProxy.headers = values.trustedProxy.headers
  settings.trustedProxy.useLeftmostIP = values.trustedProxy.useLeftmostIP
  settings.backups.cron = values.backups.cron
  settings.backups.cronMaxKeep = values.backups.cronMaxKeep
  app.save(settings)
}, (app) => {
  // Settings edited by the admin are never reverted.
})
