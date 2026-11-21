/// <reference path="../pb_data/types.d.ts" />
// Presence: who is editing which node and field right now (design 5, plan 2026-11-20-sharing
// Task 6, D14). One short-lived row per person and project. Team members and edit-link
// holders (a `link_grants` row, one alias, as in 1794400100) read and write; a person writes
// only their own row; the hook copies their name; the job `purge_presence`
// (pb_hooks/presence.pb.js) removes rows that stopped being refreshed. Never edit this file
// after it has run.

const IS_MEMBER = "@request.auth.id != '' && project.team.team_members_via_team.user ?= @request.auth.id"
const EDIT_GRANT = "(@request.auth.verified = true" +
  " && @collection.link_grants:grant.user ?= @request.auth.id" +
  " && @collection.link_grants:grant.project ?= project" +
  " && @collection.link_grants:grant.permission ?= 'edit'" +
  " && @collection.link_grants:grant.link.revoked ?= false)"
const CAN = `(${IS_MEMBER} || ${EDIT_GRANT})`

migrate((app) => {
  const projects = app.findCollectionByNameOrId("projects")
  const nodes = app.findCollectionByNameOrId("nodes")
  const users = app.findCollectionByNameOrId("users")

  app.save(new Collection({
    type: "base",
    name: "presence",
    fields: [
      { name: "project", type: "relation", required: true, collectionId: projects.id, maxSelect: 1, cascadeDelete: true },
      { name: "node", type: "relation", required: true, collectionId: nodes.id, maxSelect: 1, cascadeDelete: true },
      { name: "user", type: "relation", required: true, collectionId: users.id, maxSelect: 1, cascadeDelete: true },
      { name: "user_name", type: "text", max: 200 },
      { name: "field", type: "text", max: 40 },
      { name: "beat", type: "number", onlyInt: true, min: 0 },
      { name: "updated", type: "autodate", onCreate: true, onUpdate: true },
    ],
    indexes: [
      "CREATE UNIQUE INDEX idx_presence_user_project ON presence (user, project)",
      "CREATE INDEX idx_presence_project ON presence (project)",
      "CREATE INDEX idx_presence_updated ON presence (updated)",
    ],
    listRule: CAN,
    viewRule: CAN,
    createRule: CAN + " && @request.body.user = @request.auth.id && @request.body.node.project = @request.body.project" +
      " && @request.body.user_name:isset = false",
    updateRule: "user = @request.auth.id && @request.body.user:isset = false && @request.body.project:isset = false" +
      " && @request.body.user_name:isset = false && (@request.body.node:isset = false || @request.body.node.project = project)",
    deleteRule: "user = @request.auth.id",
  }))
}, (app) => {
  app.delete(app.findCollectionByNameOrId("presence"))
})
