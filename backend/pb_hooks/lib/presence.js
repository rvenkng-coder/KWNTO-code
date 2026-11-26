// The presence clean-up cut-off (design 5). CommonJS so hooks can load it with
// require(`${__hooks}/lib/presence.js`) and Vitest can load it too.

// The moment twice `timeoutSeconds` before `nowMs`, as PocketBase datetime text
// ("YYYY-MM-DD HH:mm:ss.SSSZ", UTC), the format of `retention.js` so it compares with
// `updated` as plain text. A row not refreshed since then belongs to a closed tab.
function staleCutoffIso(nowMs, timeoutSeconds) {
  const windowMs = timeoutSeconds * 2 * 1000
  return new Date(nowMs - windowMs).toISOString().replace("T", " ")
}

module.exports = { staleCutoffIso }
