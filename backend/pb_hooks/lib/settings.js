// Reads the system settings tables (design 7c) at run time, so a change in the
// dashboard applies to the next request without a redeploy.
// CommonJS so hooks can load it with require(`${__hooks}/lib/settings.js`).

// Each settings table holds exactly one record, created by its migration.
// A missing record means a broken install, so this throws instead of guessing defaults.
function readOnlyRecord(app, collection) {
  return app.findFirstRecordByFilter(collection, "id != ''")
}

function getSystemAccess(app) {
  const record = readOnlyRecord(app, "system_access")
  return {
    registrationOpen: record.getBool("registration_open"),
    lockdown: record.getBool("lockdown"),
    lockdownMessage: record.getString("lockdown_message"),
  }
}

function getSystemBehavior(app) {
  const record = readOnlyRecord(app, "system_behavior")
  return {
    presenceTimeoutSeconds: record.getInt("presence_timeout_seconds"),
    analyticsRetentionDays: record.getInt("analytics_retention_days"),
    trashRetentionDays: record.getInt("trash_retention_days"),
    securityRetentionDays: record.getInt("security_retention_days"),
    maxFailedLogins: record.getInt("max_failed_logins"),
    lockoutMinutes: record.getInt("lockout_minutes"),
    teamAttemptsPerHour: record.getInt("team_attempts_per_hour"),
  }
}

function getSystemStorage(app) {
  const record = readOnlyRecord(app, "system_storage")
  return {
    defaultQuotaBytes: record.getInt("default_quota_bytes"),
    maxMb: {
      audio: record.getInt("max_audio_mb"),
      video: record.getInt("max_video_mb"),
      image: record.getInt("max_image_mb"),
    },
    allowedTypes: record.getStringSlice("allowed_types"),
    totalWarningBytes: record.getInt("total_warning_bytes"),
  }
}

module.exports = { getSystemAccess, getSystemBehavior, getSystemStorage }
