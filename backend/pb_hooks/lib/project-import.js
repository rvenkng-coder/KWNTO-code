// Writes an import plan (lib/project-file.js importPlan) to the database: one new project
// with its chapters, nodes, lines, cues and choices. Call it inside e.app.runInTransaction,
// with the transaction's app, so a failure leaves nothing behind. Not pure (it needs
// PocketBase's Record), so it is covered by tests/rules/project-file.rules.test.ts.

// Saves one new record with the given fields (an `id` among them is kept).
function add(app, collection, fields) {
  const record = new Record(app.findCollectionByNameOrId(collection))
  for (const [name, value] of Object.entries(fields)) {
    record.set(name, value)
  }
  app.save(record)
  return record
}

// The project hook makes `Chapter 1` (plan D6): it is reused for the file's first chapter and
// the other chapters are made. Returns a map from a planned chapter id to the stored one.
function createChapters(app, projectId, chapters) {
  const chapterIds = {}
  chapters.forEach((chapter, index) => {
    if (index === 0) {
      const first = app.findFirstRecordByFilter("chapters", "project = {:project}", { project: projectId })
      first.set("title", chapter.title)
      first.set("position", chapter.position)
      app.save(first)
      chapterIds[chapter.id] = first.id
    } else {
      add(app, "chapters", { id: chapter.id, project: projectId, title: chapter.title, position: chapter.position })
      chapterIds[chapter.id] = chapter.id
    }
  })
  return chapterIds
}

function createContent(app, projectId, chapterIds, plan) {
  for (const n of plan.nodes) {
    add(app, "nodes", { id: n.id, project: projectId, chapter: chapterIds[n.chapter], title: n.title, color: n.color, x: n.x, y: n.y })
  }
  for (const l of plan.lines) {
    add(app, "script_lines", { id: l.id, project: projectId, node: l.node, character: l.character, text: l.text, sort_order: l.sortOrder })
  }
  for (const q of plan.cues) {
    add(app, "cues", { id: q.id, project: projectId, node: q.node, type: q.type, text: q.text, sort_order: q.sortOrder })
  }
  for (const k of plan.connections) {
    add(app, "connections", { id: k.id, project: projectId, from_node: k.from, to_node: k.to === null ? "" : k.to, label: k.label })
  }
}

// Returns the new project's id. `name` is the final name (see importedName).
function createImportedProject(app, teamId, name, plan) {
  const project = add(app, "projects", { team: teamId, name: name })
  const chapterIds = createChapters(app, project.id, plan.chapters)
  createContent(app, project.id, chapterIds, plan)
  // The first-node hook set a start node; the file's own choice (or none) replaces it.
  const stored = app.findRecordById("projects", project.id)
  stored.set("start_node", plan.startNode === null ? "" : plan.startNode)
  app.save(stored)
  return project.id
}

module.exports = { createImportedProject }
