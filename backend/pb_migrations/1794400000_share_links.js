/// <reference path="../pb_data/types.d.ts" />
// Share links and the grants an edit link makes (design 5, plan 2026-11-20-sharing Task 3,
// D2, D7 and D10). No rule is public: view and comment links are served by routes
// (pb_hooks/share.pb.js) that check the token on every request; an edit link makes a
// `link_grants` row through the join route, and the content rules (1794400100) accept it.
//
// share_links: any member lists and views; a verified member creates (the server makes the
// token, and for a snapshot the data); a member may only set `revoked` to true, and nobody
// deletes through the API. link_grants: the holder reads their own while the link stands;
// the server writes them. Never edit this file after it has run.

const IS_MEMBER = "@request.auth.id != '' && project.team.team_members_via_team.user ?= @request.auth.id"

function unset(...names) {
  return names.map((name) => ` && @request.body.${name}:isset = false`).join("")
}

migrate((app) => {
  const projects = app.findCollectionByNameOrId("projects")
  const users = app.findCollectionByNameOrId("users")

  const links = new Collection({
    type: "base",
    name: "share_links",
    fields: [
      { name: "project", type: "relation", required: true, collectionId: projects.id, maxSelect: 1, cascadeDelete: true },
      { name: "created_by", type: "relation", collectionId: users.id, maxSelect: 1, cascadeDelete: false },
      { name: "token", type: "text", required: true, min: 40, max: 40 },
      { name: "permission", type: "select", required: true, values: ["view", "comment", "edit"], maxSelect: 1 },
      { name: "kind", type: "select", required: true, values: ["live", "snapshot"], maxSelect: 1 },
      { name: "revoked", type: "bool" },
      { name: "snapshot_data", type: "json", maxSize: 6291456 },
      { name: "created", type: "autodate", onCreate: true },
      { name: "updated", type: "autodate", onCreate: true, onUpdate: true },
    ],
    indexes: [
      "CREATE UNIQUE INDEX idx_share_links_token ON share_links (token)",
      "CREATE INDEX idx_share_links_project ON share_links (project)",
    ],
    listRule: IS_MEMBER,
    viewRule: IS_MEMBER,
    createRule: IS_MEMBER + " && @request.auth.verified = true && @request.body.created_by = @request.auth.id" +
      unset("token", "revoked", "snapshot_data") +
      " && (@request.body.kind = 'live' || @request.body.permission = 'view')",
    updateRule: IS_MEMBER + " && @request.body.revoked = true" +
      unset("project", "created_by", "token", "permission", "kind", "snapshot_data"),
    deleteRule: null,
  })
  app.save(links)

  const grants = new Collection({
    type: "base",
    name: "link_grants",
    fields: [
      { name: "link", type: "relation", required: true, collectionId: links.id, maxSelect: 1, cascadeDelete: true },
      { name: "user", type: "relation", required: true, collectionId: users.id, maxSelect: 1, cascadeDelete: true },
      { name: "project", type: "relation", required: true, collectionId: projects.id, maxSelect: 1, cascadeDelete: true },
      { name: "permission", type: "select", required: true, values: ["comment", "edit"], maxSelect: 1 },
      { name: "project_name", type: "text", max: 120 },
      { name: "created", type: "autodate", onCreate: true },
    ],
    indexes: [
      "CREATE UNIQUE INDEX idx_link_grants_link_user ON link_grants (link, user)",
      "CREATE INDEX idx_link_grants_user ON link_grants (user)",
      "CREATE INDEX idx_link_grants_project ON link_grants (project)",
    ],
    listRule: "@request.auth.id != '' && user = @request.auth.id && link.revoked = false",
    viewRule: "@request.auth.id != '' && user = @request.auth.id && link.revoked = false",
    createRule: null,
    updateRule: null,
    deleteRule: null,
  })
  app.save(grants)
}, (app) => {
  app.delete(app.findCollectionByNameOrId("link_grants"))
  app.delete(app.findCollectionByNameOrId("share_links"))
})
