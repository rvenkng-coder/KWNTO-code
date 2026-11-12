// Writes the admin-only security log (design 6.9, docs/security.md section 8).
// CommonJS so hooks can load it with require(`${__hooks}/lib/security-log.js`).

// type is one of: signup, verification, sign-in, failure, lockout, reset, invite, join, admin
// userId is "" when no account is involved. Never throws: a logging failure must not
// block a sign-in or a join, so it is reported on the server console instead.
function logEvent(app, type, userId, ip, detail) {
  try {
    // Record is the global class the PocketBase hook runtime provides.
    const record = new Record(app.findCollectionByNameOrId("security_events"))
    record.set("type", type)
    record.set("user", userId)
    record.set("ip", ip)
    record.set("detail", detail)
    app.save(record)
  } catch (error) {
    console.error(`security log: could not record a "${type}" event:`, String(error))
  }
}

module.exports = { logEvent }
