// The trash decisions (design 6.8, plan D11). CommonJS so hooks can load it with
// require(`${__hooks}/lib/trash.js`) and Vitest can load it too.

// The time a trashed record is stamped with. The browser's value is never trusted: a wrong
// clock or a hand-made request could otherwise date a node 31 days back and get it purged
// tonight. An empty value means "restore" and stays empty.
function serverDeletedAt(sent, nowIso) {
  if (sent === '' || sent === null || sent === undefined) return ''
  return nowIso
}

// True when a record was trashed before the cut-off. Both are PocketBase datetime text
// ("YYYY-MM-DD HH:mm:ss.SSSZ"), which compares in time order as plain strings.
function isExpired(deletedAtIso, cutoffIso) {
  return deletedAtIso !== '' && deletedAtIso < cutoffIso
}

module.exports = { serverDeletedAt, isExpired }
