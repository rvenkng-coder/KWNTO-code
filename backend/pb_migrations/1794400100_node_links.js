/// <reference path="../pb_data/types.d.ts" />
// Links and other material on a node (plan 2026-11-21-node-links, D5). Same access as media: members
// of the project's team with a verified account; nobody edits a link (delete and add again); any member
// deletes it. No quota. The address rule is enforced by the hook in links.pb.js.

const IS_MEMBER = "@request.auth.id != '' && project.team.team_members_via_team.user ?= @request.auth.id"

migrate((app) => {
  const projects = app.findCollectionByNameOrId("projects")
  const nodes = app.findCollectionByNameOrId("nodes")
  const users = app.findCollectionByNameOrId("users")

  const links = new Collection({
    type: "base",
    name: "node_links",
    fields: [
      { name: "project", type: "relation", required: true, collectionId: projects.id, maxSelect: 1, cascadeDelete: true },
      { name: "node", type: "relation", required: true, collectionId: nodes.id, maxSelect: 1, cascadeDelete: true },
      { name: "creator", type: "relation", required: true, collectionId: users.id, maxSelect: 1, cascadeDelete: false },
      { name: "title", type: "text", max: 120 },
      { name: "url", type: "text", required: true, max: 2000 },
      { name: "created", type: "autodate", onCreate: true },
    ],
    indexes: [
      "CREATE INDEX idx_node_links_project ON node_links (project)",
      "CREATE INDEX idx_node_links_node ON node_links (node)",
    ],
    listRule: IS_MEMBER,
    viewRule: IS_MEMBER,
    createRule: IS_MEMBER +
      " && @request.auth.verified = true && @request.body.creator = @request.auth.id && @request.body.node.project = @request.body.project",
    updateRule: null,
    deleteRule: IS_MEMBER,
  })

  app.save(links)
}, (app) => {
  app.delete(app.findCollectionByNameOrId("node_links"))
})
