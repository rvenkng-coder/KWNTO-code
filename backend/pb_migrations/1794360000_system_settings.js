/// <reference path="../pb_data/types.d.ts" />
// Creates the three system settings tables of design 7c, one record each, admin only.
// Defaults are written here once: PocketBase runs a migration once per data folder,
// so a restart never overwrites a value the admin changed in the dashboard.
// Never edit this file after it has run; a change needs a new migration.

// Whole numbers, never negative: a negative retention or limit has no sensible meaning.
function count(name) {
  return { name: name, type: "number", onlyInt: true, min: 0 }
}

const TABLES = [
  {
    name: "system_access",
    fields: [
      { name: "registration_open", type: "bool" },
      { name: "lockdown", type: "bool" },
      { name: "lockdown_message", type: "text", max: 500 },
    ],
    defaults: { registration_open: true, lockdown: false, lockdown_message: "" },
  },
  {
    name: "system_storage",
    fields: [
      count("default_quota_bytes"),
      count("max_video_mb"),
      count("max_audio_mb"),
      count("max_image_mb"),
      { name: "allowed_types", type: "json", maxSize: 2000 },
    ],
    defaults: {
      default_quota_bytes: 2147483648, // 2 GB per user (design 7c)
      max_video_mb: 200,
      max_audio_mb: 50,
      max_image_mb: 50,
      allowed_types: ["wav", "mp3", "mov", "mp4", "jpeg", "png"],
    },
  },
  {
    name: "system_behavior",
    fields: [
      count("presence_timeout_seconds"),
      count("analytics_retention_days"),
      count("trash_retention_days"),
      count("security_retention_days"),
      count("max_failed_logins"),
      count("lockout_minutes"),
      count("team_attempts_per_hour"), // decision D3 of the accounts and teams plan
    ],
    defaults: {
      presence_timeout_seconds: 30,
      analytics_retention_days: 365,
      trash_retention_days: 30,
      security_retention_days: 365,
      max_failed_logins: 3,
      lockout_minutes: 5,
      team_attempts_per_hour: 20,
    },
  },
]

migrate((app) => {
  for (const table of TABLES) {
    // Every rule null: only the admin (superusers) may read or change settings.
    const collection = new Collection({
      type: "base",
      name: table.name,
      listRule: null,
      viewRule: null,
      createRule: null,
      updateRule: null,
      deleteRule: null,
      fields: table.fields,
    })
    app.save(collection)

    const record = new Record(collection)
    for (const key of Object.keys(table.defaults)) {
      record.set(key, table.defaults[key])
    }
    app.save(record)
  }
}, (app) => {
  for (const table of TABLES) {
    app.delete(app.findCollectionByNameOrId(table.name))
  }
})
