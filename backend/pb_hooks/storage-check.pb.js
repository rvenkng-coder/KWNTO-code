/// <reference path="../pb_data/types.d.ts" />
// The disk-usage warning (design 7c, plan 6 D12): every hour, add up every stored file;
// over system_storage.total_warning_bytes, and if no warning went out in the last 24
// hours, write a `storage` security log entry and mail every admin (when mail is set up).

cronAdd("kwnto_storage_check", "0 * * * *", () => {
  // Hook handlers run in isolated scopes, so helpers are loaded inside the handler.
  const { getSystemStorage } = require(`${__hooks}/lib/settings.js`)
  const { logEvent } = require(`${__hooks}/lib/security-log.js`)
  const { shouldWarn, warningSubject } = require(`${__hooks}/lib/storage-warning.js`)
  const { formatBytes } = require(`${__hooks}/lib/media-check.js`)

  const limitBytes = getSystemStorage($app).totalWarningBytes
  const total = new DynamicModel({ total: 0 })
  $app.db().newQuery("SELECT COALESCE(SUM(size_bytes), 0) AS total FROM media").one(total)
  const usedBytes = total.total

  const last = $app.findRecordsByFilter("security_events", "type = 'storage'", "-created", 1, 0)
  const lastWarnedMs = last.length === 0 ? null : last[0].getDateTime("created").time().unixMilli()
  if (!shouldWarn(usedBytes, limitBytes, lastWarnedMs, Date.now())) {
    return
  }

  // Logged first: the entry is what makes it "at most once a day", whatever the mail does.
  logEvent($app, "storage", "", "", { usedBytes: usedBytes, limitBytes: limitBytes })

  if (!$app.settings().smtp.enabled) {
    return
  }
  const subject = warningSubject(usedBytes, limitBytes)
  const text =
    `KWNTO is storing ${formatBytes(usedBytes)} of uploaded files, which is over the warning ` +
    `limit of ${formatBytes(limitBytes)} (the total_warning_bytes setting). Free some space or ` +
    `raise the limit; see docs/admin/deployment.md, "When the disk fills".`
  const meta = $app.settings().meta
  // One failed recipient or a broken mail setup must not stop the others or the job.
  for (const admin of $app.findAllRecords("_superusers")) {
    try {
      $app.newMailClient().send(
        new MailerMessage({
          from: { address: meta.senderAddress, name: meta.senderName },
          to: [{ address: admin.email() }],
          subject: subject,
          text: text,
        }),
      )
    } catch (error) {
      // The server console is the only place a hook can report this; the log entry is already written.
      // eslint-disable-next-line no-console
      console.error(`storage check: could not mail ${admin.email()}:`, String(error))
    }
  }
})
