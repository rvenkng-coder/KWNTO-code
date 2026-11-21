/// <reference path="../pb_data/types.d.ts" />
// A project in the trash is hidden with its contents (design 6.8), also from people who joined
// an edit or comment link before it was trashed (plan 2026-11-20-sharing, whole-branch review
// finding M1). Until now a grant row only checked that its link was not revoked, so a holder
// kept reading and editing for the whole retention period. Every grant fragment in the rules
// of 1794400100, 1794400200 and 1794400300 now also needs the grant's project to be out of the
// trash, and the holder's own `link_grants` rows are hidden while it is in, so "Shared with me"
// drops it. Restoring the project gives everything back; the link and the grant are untouched.
// Team members are not affected (they see the trash). The down migration removes the added
// condition again. Never edit this file after it has run.

const LINK_LIVE = "@collection.link_grants:grant.link.revoked ?= false"
const PROJECT_OUT_OF_TRASH = " && @collection.link_grants:grant.project.deleted_at ?= ''"
const GRANT_ROW_OUT_OF_TRASH = " && project.deleted_at = ''"
const GRANT_RULES = ["listRule", "viewRule"]
const CONTENT_RULES = ["listRule", "viewRule", "createRule", "updateRule", "deleteRule"]
const COLLECTIONS = [
  "projects", "project_settings", "chapters", "nodes", "script_lines", "cues", "connections",
  "media", "comments", "presence",
]

function change(app, add) {
  for (const name of COLLECTIONS) {
    const collection = app.findCollectionByNameOrId(name)
    for (const rule of CONTENT_RULES) {
      // A rule may be null (locked); a set rule is read through String(), as 1794400100 does.
      const text = String(collection[rule] || "")
      if (!text.includes(LINK_LIVE)) continue
      collection[rule] = add
        ? text.split(LINK_LIVE).join(LINK_LIVE + PROJECT_OUT_OF_TRASH)
        : text.split(LINK_LIVE + PROJECT_OUT_OF_TRASH).join(LINK_LIVE)
    }
    app.save(collection)
  }
  const grants = app.findCollectionByNameOrId("link_grants")
  for (const rule of GRANT_RULES) {
    grants[rule] = add ? String(grants[rule]) + GRANT_ROW_OUT_OF_TRASH : String(grants[rule]).split(GRANT_ROW_OUT_OF_TRASH).join("")
  }
  app.save(grants)
}

migrate((app) => change(app, true), (app) => change(app, false))
