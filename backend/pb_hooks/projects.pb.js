/// <reference path="../pb_data/types.d.ts" />
// Projects (design section 5): a new project gets its settings row (analytics
// off) and a first chapter, `Chapter 1` at position 1. And the first node made
// in a project becomes its start node. Model hooks, so they hold for every way a project
// or node is made: the API, the admin dashboard and server code.

// The project's own insert (e.next()) stays outside a transaction of ours, so PocketBase
// sends the live create event (see the nodes hook below); its settings row and first chapter
// are saved together in a transaction of their own. If that fails, the project is deleted
// again and the error goes on, so no project exists without them.
onRecordCreate((e) => {
  e.next()
  try {
    e.app.runInTransaction((txApp) => {
      const settings = new Record(txApp.findCollectionByNameOrId("project_settings"))
      settings.set("project", e.record.id)
      settings.set("analytics_enabled", false)
      txApp.save(settings)

      const chapter = new Record(txApp.findCollectionByNameOrId("chapters"))
      chapter.set("project", e.record.id)
      chapter.set("title", "Chapter 1")
      chapter.set("position", 1)
      txApp.save(chapter)
    })
  } catch (err) {
    e.app.delete(e.record)
    throw err
  }
}, "projects")

// A node made in a project with no start node becomes it, and the project's
// version rises by 1 so an edit of the project based on the old version gets a 409
// (decision 0002) instead of emptying start_node again. The node's own insert (e.next())
// must stay outside a transaction of ours: with the insert moved into one (e.app = txApp),
// PocketBase 0.40.6 sends no realtime create event for the node, so teammates never see it
// (tests/rules/content-door.rules.test.ts pins it). The check and the
// project save run in their own transaction; SQLite admits one writer at a time, so two
// first nodes made at once cannot both win. If that part fails, the node stays and the
// project has no start node until one is marked (the editor says "No start node").
onRecordCreate((e) => {
  e.next()
  e.app.runInTransaction((txApp) => {
    const project = txApp.findRecordById("projects", e.record.getString("project"))
    if (project.getString("start_node") !== "") return
    project.set("start_node", e.record.id)
    project.set("version", project.getInt("version") + 1)
    txApp.save(project)
  })
}, "nodes")
