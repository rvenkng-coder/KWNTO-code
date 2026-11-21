/// <reference path="../pb_data/types.d.ts" />
// Links on a node: only http and https addresses are stored (plan 2026-11-21-node-links, D4).

onRecordCreate((e) => {
  const { checkLinkUrl } = require(`${__hooks}/lib/link-check.js`)
  const check = checkLinkUrl(e.record.getString("url"))
  if (!check.ok) {
    throw new BadRequestError(check.message, { url: new ValidationError(check.code, check.message) })
  }
  e.record.set("url", check.url)
  e.record.set("title", e.record.getString("title").trim())
  e.next()
}, "node_links")
