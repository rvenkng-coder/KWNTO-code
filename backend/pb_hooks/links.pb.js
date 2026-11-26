/// <reference path="../pb_data/types.d.ts" />
// Links on a node: only http and https addresses are stored. The rule runs on create and on
// update; the access rules already refuse updates from users, so an update here is an admin
// edit, and it must not be able to store a non-web address either.

onRecordCreate((e) => {
  const { guardLinkRecord } = require(`${__hooks}/lib/link-hook.js`)
  guardLinkRecord(e.record)
  e.next()
}, "node_links")

onRecordUpdate((e) => {
  const { guardLinkRecord } = require(`${__hooks}/lib/link-hook.js`)
  guardLinkRecord(e.record)
  e.next()
}, "node_links")
