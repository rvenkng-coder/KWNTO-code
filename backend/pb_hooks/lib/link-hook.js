// Applies the address rule to a node_links record before it is saved, on create and on update (an admin
// edit in the dashboard goes through update). Throws a field error on `url` when the address is refused.
const { checkLinkUrl } = require(`${__hooks}/lib/link-check.js`)

function guardLinkRecord(record) {
  const check = checkLinkUrl(record.getString("url"))
  if (!check.ok) {
    throw new BadRequestError(check.message, { url: new ValidationError(check.code, check.message) })
  }
  record.set("url", check.url)
  record.set("title", record.getString("title").trim())
}

module.exports = { guardLinkRecord }
