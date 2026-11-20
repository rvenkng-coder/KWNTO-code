/// <reference path="../pb_data/types.d.ts" />
// Share links (design 5, plan 7 Task 3). The server makes the token, and for a snapshot the
// stored file, when a link is created. The routes are added in checkpoint 3B.

onRecordCreate((e) => {
  const { buildProjectFile } = require(`${__hooks}/lib/project-file.js`)
  const { loadProjectRecords } = require(`${__hooks}/lib/project-records.js`)

  // About 238 bits from the server's own random source; a client can never choose one.
  e.record.set("token", $security.randomStringWithAlphabet(40, "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789"))
  if (e.record.getString("kind") === "snapshot") {
    const records = loadProjectRecords(e.app, e.record.getString("project"))
    e.record.set("snapshot_data", buildProjectFile(records, new Date().toISOString().replace("T", " ")))
  }
  e.next()
}, "share_links")
