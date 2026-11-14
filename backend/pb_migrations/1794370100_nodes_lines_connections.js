/// <reference path="../pb_data/types.d.ts" />
// Nodes, their script lines and cues, and the connections between nodes (design sections
// 5 and 6.1, ERD; editor core plan Task 6). The fragments follow
// 1794370000_projects_chapters.js: every update goes through the version guard
// (pb_hooks/content-guard.pb.js, decision 0002), so the update rules require `version`
// and the create rules forbid it. Every record carries `project`, set on create and never
// changed, and every reference in a create body must point into that same project (plan
// Review Focus 2); updates may not change a reference at all. Nodes are trashed
// (`deleted_at`, design 6.8), so their delete is locked; lines, cues and connections are
// deleted outright (undo re-creates them with their old id). Never edit this file after
// it has run.

const IS_MEMBER = "@request.auth.id != '' && project.team.team_members_via_team.user ?= @request.auth.id"
const VERSION_UNSET = " && @request.body.version:isset = false"
const UPDATE_GUARDED = " && @request.body.version:isset = true && @request.body.project:isset = false"

// On create, `@request.body.<relation>.project` is the project of the record the body
// points at, so these refuse a reference into any project but the body's own.
function sameProject(relation) {
  return ` && @request.body.${relation}.project = @request.body.project`
}

function unset(...names) {
  return names.map((name) => ` && @request.body.${name}:isset = false`).join("")
}

const VERSION = { name: "version", type: "number", onlyInt: true, min: 0 }
const CREATED = { name: "created", type: "autodate", onCreate: true }
const UPDATED = { name: "updated", type: "autodate", onCreate: true, onUpdate: true }
const COLORS = ["slate", "red", "orange", "amber", "green", "teal", "blue", "purple"]

function projectField(projects) {
  return { name: "project", type: "relation", required: true, collectionId: projects.id, maxSelect: 1, cascadeDelete: true }
}

function nodeField(name, nodes) {
  return { name, type: "relation", required: true, collectionId: nodes.id, maxSelect: 1, cascadeDelete: true }
}

// Lines and cues hang off one node and are written by any member.
function nodeChild(name, projects, nodes, fields) {
  return new Collection({
    type: "base",
    name,
    fields: [projectField(projects), nodeField("node", nodes), ...fields, VERSION, CREATED, UPDATED],
    indexes: [
      `CREATE INDEX idx_${name}_project ON ${name} (project)`,
      `CREATE INDEX idx_${name}_node ON ${name} (node)`,
    ],
    listRule: IS_MEMBER,
    viewRule: IS_MEMBER,
    createRule: IS_MEMBER + VERSION_UNSET + sameProject("node"),
    updateRule: IS_MEMBER + UPDATE_GUARDED + unset("node"),
    deleteRule: IS_MEMBER,
  })
}

migrate((app) => {
  const projects = app.findCollectionByNameOrId("projects")
  const chapters = app.findCollectionByNameOrId("chapters")

  const nodes = new Collection({
    type: "base",
    name: "nodes",
    fields: [
      projectField(projects),
      { name: "chapter", type: "relation", required: true, collectionId: chapters.id, maxSelect: 1, cascadeDelete: true },
      { name: "title", type: "text", max: 200 },
      // The node header palette (plan D9, frontend/src/features/editor/model/colors.ts).
      { name: "color", type: "select", required: true, maxSelect: 1, values: COLORS },
      { name: "x", type: "number" },
      { name: "y", type: "number" },
      { name: "deleted_at", type: "date" },
      VERSION,
      CREATED,
      UPDATED,
    ],
    indexes: [
      "CREATE INDEX idx_nodes_project ON nodes (project)",
      "CREATE INDEX idx_nodes_chapter ON nodes (chapter)",
    ],
    listRule: IS_MEMBER,
    viewRule: IS_MEMBER,
    createRule: IS_MEMBER + VERSION_UNSET + unset("deleted_at") + sameProject("chapter"),
    // A node never moves to another chapter (plan D9: cut and paste instead).
    updateRule: IS_MEMBER + UPDATE_GUARDED + unset("chapter"),
    deleteRule: null,
  })
  app.save(nodes)

  app.save(nodeChild("script_lines", projects, nodes, [
    { name: "character", type: "text", max: 80 },
    { name: "text", type: "text", max: 5000 },
    // A decimal, so a line can go between two others (plan D4).
    { name: "sort_order", type: "number" },
  ]))

  app.save(nodeChild("cues", projects, nodes, [
    { name: "type", type: "select", required: true, maxSelect: 1, values: ["audio", "lighting", "other"] },
    { name: "text", type: "text", max: 2000 },
    { name: "sort_order", type: "number" },
  ]))

  app.save(new Collection({
    type: "base",
    name: "connections",
    fields: [
      projectField(projects),
      nodeField("from_node", nodes),
      nodeField("to_node", nodes),
      { name: "label", type: "text", max: 200 },
      VERSION,
      CREATED,
      UPDATED,
    ],
    // One connection per ordered pair; a node may link to itself (design 6.1).
    indexes: [
      "CREATE INDEX idx_connections_project ON connections (project)",
      "CREATE UNIQUE INDEX idx_connections_pair ON connections (from_node, to_node)",
      "CREATE INDEX idx_connections_to_node ON connections (to_node)",
    ],
    listRule: IS_MEMBER,
    viewRule: IS_MEMBER,
    createRule: IS_MEMBER + VERSION_UNSET + sameProject("from_node") + sameProject("to_node"),
    updateRule: IS_MEMBER + UPDATE_GUARDED + unset("from_node", "to_node"),
    deleteRule: IS_MEMBER,
  }))

  // The node a playthrough starts at (plan D7). No cascade: purging the node empties it.
  projects.fields.add(new RelationField({ name: "start_node", collectionId: nodes.id, maxSelect: 1, cascadeDelete: false }))
  app.save(projects)
}, (app) => {
  const projects = app.findCollectionByNameOrId("projects")
  projects.fields.removeByName("start_node")
  app.save(projects)
  for (const name of ["connections", "cues", "script_lines", "nodes"]) {
    app.delete(app.findCollectionByNameOrId(name))
  }
})
