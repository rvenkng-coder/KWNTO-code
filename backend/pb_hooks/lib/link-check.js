// The address rule for node links (plan 2026-11-21-node-links, D4). Pure, so it is unit tested.
// PocketBase's JS runtime has no URL class, so the rule is a regular expression. Only http and https
// addresses with a host are accepted; a user name in front of the host, spaces, and every other scheme
// are refused. The client has a copy in frontend/src/features/editor/links/linkCheck.ts; a rules test
// keeps the two in step.
const MAX_LENGTH = 2000
const WEB_ADDRESS = /^(https?):\/\/([^\s/?#@\\]+)([/?#]\S*)?$/i

function refuse(code, message) {
  return { ok: false, code, message }
}

function checkLinkUrl(raw) {
  const url = String(raw == null ? "" : raw).trim()
  if (url === "") return refuse("link_url_empty", "Enter a web address.")
  if (url.length > MAX_LENGTH) return refuse("link_url_too_long", "The address is longer than 2000 characters.")
  if (WEB_ADDRESS.test(url)) return { ok: true, url }
  if (/^https?:\/\//i.test(url)) return refuse("link_url_invalid", "That is not a web address.")
  if (url.startsWith("//") || /^[a-z][a-z0-9+.-]*:/i.test(url)) {
    return refuse("link_url_scheme", "Only http:// and https:// addresses are allowed.")
  }
  return refuse("link_url_invalid", "That is not a web address.")
}

module.exports = { checkLinkUrl }
