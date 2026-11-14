/// <reference path="../pb_data/types.d.ts" />
// Projects (design section 5, plan D6): a new project gets its settings row (analytics
// off) and a first chapter, `Chapter 1` at position 1. And (plan D7) the first node made
// in a project becomes its start node. Model hooks, so they hold for every way a project
// or node is made: the API, the admin dashboard and server code.

// The project, its settings and its first chapter are saved in one transaction, so no
// project exists without them. As in teams.pb.js: PocketBase 0.40.6 does not wrap a
// record create in a transaction, so it is opened here and the project's own insert
// (e.next()) is moved into it by pointing the event at the transaction's app.
onRecordCreate((e) => {
  e.app.runInTransaction((txApp) => {
    e.app = txApp
    e.next()

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
}, "projects")

// Plan D7: a node made in a project with no start node becomes it, in the node's own
// transaction, and the project's version rises by 1 so an edit of the project based on
// the old version gets a 409 (decision 0002) instead of emptying start_node again.
// SQLite admits one writer at a time, so two first nodes made at once cannot both win.
onRecordCreate((e) => {
  e.app.runInTransaction((txApp) => {
    e.app = txApp
    e.next()

    const project = txApp.findRecordById("projects", e.record.getString("project"))
    if (project.getString("start_node") !== "") return
    project.set("start_node", e.record.id)
    project.set("version", project.getInt("version") + 1)
    txApp.save(project)
  })
}, "nodes")
