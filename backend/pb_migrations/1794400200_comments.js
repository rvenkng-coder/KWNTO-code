/// <reference path="../pb_data/types.d.ts" />
// Comments on nodes (design 5, plan 2026-11-20-sharing Task 5, D8 and D13). Team members and
// holders of a comment or edit link (a `link_grants` row, one alias so every condition is about
// the same row, as in 1794400100) read and write them. The author's name is copied by the
// hook (pb_hooks/comments.pb.js), because commenters may not read each other's accounts.
// Nobody edits a comment; the author or the team owner deletes it. Never edit this file after
// it has run.

const IS_MEMBER = "@request.auth.id != '' && project.team.team_members_via_team.user ?= @request.auth.id"
const COMMENT_GRANT = "(@request.auth.verified = true" +
  " && @collection.link_grants:grant.user ?= @request.auth.id" +
  " && @collection.link_grants:grant.project ?= project" +
  " && (@collection.link_grants:grant.permission ?= 'comment' || @collection.link_grants:grant.permission ?= 'edit')" +
  " && @collection.link_grants:grant.link.revoked ?= false)"
const CAN_READ = `(${IS_MEMBER} || ${COMMENT_GRANT})`

migrate((app) => {
  const projects = app.findCollectionByNameOrId("projects")
  const nodes = app.findCollectionByNameOrId("nodes")
  const users = app.findCollectionByNameOrId("users")

  app.save(new Collection({
    type: "base",
    name: "comments",
    fields: [
      { name: "project", type: "relation", required: true, collectionId: projects.id, maxSelect: 1, cascadeDelete: true },
      { name: "node", type: "relation", required: true, collectionId: nodes.id, maxSelect: 1, cascadeDelete: true },
      { name: "author", type: "relation", collectionId: users.id, maxSelect: 1, cascadeDelete: false },
      { name: "author_name", type: "text", max: 200 },
      { name: "body", type: "text", required: true, min: 1, max: 2000 },
      { name: "created", type: "autodate", onCreate: true },
    ],
    indexes: [
      "CREATE INDEX idx_comments_project ON comments (project)",
      "CREATE INDEX idx_comments_node ON comments (node)",
    ],
    listRule: CAN_READ,
    viewRule: CAN_READ,
    createRule: CAN_READ + " && @request.auth.verified = true && @request.body.author = @request.auth.id" +
      " && @request.body.node.project = @request.body.project && @request.body.node.deleted_at = ''" +
      " && @request.body.author_name:isset = false",
    updateRule: null,
    deleteRule: "@request.auth.id != '' && (author = @request.auth.id || project.team.owner = @request.auth.id)",
  }))
}, (app) => {
  app.delete(app.findCollectionByNameOrId("comments"))
})
