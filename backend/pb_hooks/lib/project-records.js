// Reads every record of one project as plain objects with the stored field names, the shape
// buildProjectFile (lib/project-file.js) takes. Shared by the export route, and later by
// snapshots and the shared view (plan 7 D4), so there is one reader. Not pure (it needs a
// PocketBase app), so it is covered by the rules tests, not by a unit test.

function plain(record, fields) {
  const out = { id: record.id }
  for (const [name, kind] of Object.entries(fields)) {
    out[name] = kind === "number" ? record.getFloat(name) : record.getString(name)
  }
  return out
}

// Each collection's fields the file needs. `deleted_at` and `removed_at` are text here:
// empty means live.
const READ = {
  chapters: { title: "text", position: "number", deleted_at: "text" },
  nodes: {
    chapter: "text",
    title: "text",
    color: "text",
    x: "number",
    y: "number",
    width: "number",
    height: "number",
    cover_media: "text",
    deleted_at: "text",
  },
  script_lines: { node: "text", character: "text", text: "text", sort_order: "number" },
  cues: { node: "text", type: "text", text: "text", sort_order: "number" },
  connections: { from_node: "text", to_node: "text", label: "text", created: "text" },
  media: { node: "text", title: "text", kind: "text", removed_at: "text" },
  node_links: { node: "text", title: "text", url: "text", created: "text" },
}

function loadProjectRecords(app, projectId) {
  const project = app.findRecordById("projects", projectId)
  const records = { project: plain(project, { name: "text", start_node: "text" }) }
  for (const [collection, fields] of Object.entries(READ)) {
    const rows = app.findAllRecords(collection, $dbx.hashExp({ project: projectId }))
    records[collection] = rows.map((row) => plain(row, fields))
  }
  return records
}

module.exports = { loadProjectRecords }
