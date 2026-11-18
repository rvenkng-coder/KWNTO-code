/// <reference path="../pb_data/types.d.ts" />
// Open choices (editor cards design, goal 1): a choice is a `connections` record whose
// `to_node` may be empty, and may change within the project. Purging a target node leaves
// an empty choice (no cascade). The unique pair index applies to linked choices only, so a
// node may have many empty choices but one choice per target. `to_node` is still only ever
// a node of the record's own project (plan Review Focus 1). 1794370100 is never edited.

// Copied verbatim from 1794370100_nodes_lines_connections.js.
const IS_MEMBER = "@request.auth.id != '' && project.team.team_members_via_team.user ?= @request.auth.id"
const VERSION_UNSET = " && @request.body.version:isset = false"
const UPDATE_GUARDED = " && @request.body.version:isset = true && @request.body.project:isset = false"

function sameProject(relation) {
  return ` && @request.body.${relation}.project = @request.body.project`
}

function unset(...names) {
  return names.map((name) => ` && @request.body.${name}:isset = false`).join("")
}

const OPEN_CREATE = " && (@request.body.to_node:isset = false || @request.body.to_node = ''" +
  " || @request.body.to_node.project = @request.body.project)"
const OPEN_UPDATE = " && (@request.body.to_node:isset = false || @request.body.to_node = ''" +
  " || @request.body.to_node.project = project)"

migrate((app) => {
  const connections = app.findCollectionByNameOrId("connections")
  const to = connections.fields.getByName("to_node")
  to.required = false
  to.cascadeDelete = false
  connections.indexes = connections.indexes.map((sql) => sql.includes("idx_connections_pair")
    ? "CREATE UNIQUE INDEX idx_connections_pair ON connections (from_node, to_node) WHERE to_node != ''"
    : sql)
  connections.createRule = IS_MEMBER + VERSION_UNSET + sameProject("from_node") + OPEN_CREATE
  connections.updateRule = IS_MEMBER + UPDATE_GUARDED + unset("from_node") + OPEN_UPDATE
  app.save(connections)
}, (app) => {
  const connections = app.findCollectionByNameOrId("connections")
  // Empty choices cannot exist under the old required field.
  app.db().newQuery("DELETE FROM connections WHERE to_node = ''").execute()
  const to = connections.fields.getByName("to_node")
  to.required = true
  to.cascadeDelete = true
  connections.indexes = connections.indexes.map((sql) => sql.includes("idx_connections_pair")
    ? "CREATE UNIQUE INDEX idx_connections_pair ON connections (from_node, to_node)"
    : sql)
  connections.createRule = IS_MEMBER + VERSION_UNSET + sameProject("from_node") + sameProject("to_node")
  connections.updateRule = IS_MEMBER + UPDATE_GUARDED + unset("from_node", "to_node")
  app.save(connections)
})
