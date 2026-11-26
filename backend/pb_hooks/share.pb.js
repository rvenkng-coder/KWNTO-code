/// <reference path="../pb_data/types.d.ts" />
// Share links (design 5, plan 7 Task 3). The server makes the token, and for a snapshot the
// stored file, when a link is created. The routes are added in checkpoint 3B.

onRecordCreate((e) => {
  const { buildProjectFile } = require(`${__hooks}/lib/project-file.js`)
  const { loadProjectRecords } = require(`${__hooks}/lib/project-records.js`)
  const { utf8Length } = require(`${__hooks}/lib/project-file.js`)

  // About 238 bits from the server's own random source; a client can never choose one.
  e.record.set(
    "token",
    $security.randomStringWithAlphabet(40, "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789"),
  )
  if (e.record.getString("kind") === "snapshot") {
    const records = loadProjectRecords(e.app, e.record.getString("project"))
    const file = buildProjectFile(records, new Date().toISOString().replace("T", " "))
    // The field holds at most 6 MB (migration 1794400000); say so instead of the database's bare 400.
    if (utf8Length(JSON.stringify(file)) > 6291456) {
      throw new BadRequestError("This project is too large for a snapshot (6 MB limit). Use a live link.")
    }
    e.record.set("snapshot_data", file)
  }
  e.next()
}, "share_links")

// The routes. Every token is looked up as a bound parameter. A view link and a comment link
// are read through these routes with the app's privileges (plan 7 D2); an edit link is
// joined here and then works through the content rules.

routerAdd("GET", "/api/kwnto/share/{token}", (e) => {
  return require(`${__hooks}/lib/share-routes.js`).handleOpen(e)
})

routerAdd("POST", "/api/kwnto/share/{token}/join", (e) => {
  return require(`${__hooks}/lib/share-routes.js`).handleJoin(e)
})

routerAdd("GET", "/api/kwnto/share/{token}/media/{mediaId}", (e) => {
  return require(`${__hooks}/lib/share-routes.js`).handleMedia(e)
})

routerAdd(
  "POST",
  "/api/kwnto/share-links/{id}/republish",
  (e) => {
    return require(`${__hooks}/lib/share-routes.js`).handleRepublish(e)
  },
  $apis.requireAuth("users"),
)
