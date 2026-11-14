/// <reference path="../pb_data/types.d.ts" />
// Projects (design section 5, plan D6): a new project gets its settings row (analytics
// off) and a first chapter, `Chapter 1` at position 1. A model hook, so it holds for
// every way a project is made: the API, the admin dashboard and server code.

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
