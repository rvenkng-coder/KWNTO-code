/// <reference path="../pb_data/types.d.ts" />
// Projects, their settings and their chapters (design sections 5 and 6.2, ERD; editor
// core plan Task 5). A new project gets its settings row and `Chapter 1` from
// pb_hooks/projects.pb.js. Every update goes through the version guard
// (pb_hooks/content-guard.pb.js, decision 0002, plan D3): the update rules require the
// client to send `version`, the create rules forbid it (it starts at 0). Deleting is a
// move to the trash (an update of `deleted_at`, design 6.8), so delete is locked; the
// purge is a server job (Plan 7). Never edit this file after it has run.
//
// Task 6 copies these fragments for nodes, script_lines, cues and connections.

const IS_TEAM_MEMBER = "@request.auth.id != '' && team.team_members_via_team.user ?= @request.auth.id"
const IS_TEAM_MEMBER_OF_PROJECT = "@request.auth.id != '' && project.team.team_members_via_team.user ?= @request.auth.id"
// On create, the record's fields are the values in the request body, so these check the
// team or project the caller is putting the new record in.
const CREATE_NEW = " && @request.body.version:isset = false && @request.body.deleted_at:isset = false"
const UPDATE_GUARDED = " && @request.body.version:isset = true"

// Every content record carries a counter that only the guard changes.
const VERSION = { name: "version", type: "number", onlyInt: true, min: 0 }
const CREATED = { name: "created", type: "autodate", onCreate: true }
const UPDATED = { name: "updated", type: "autodate", onCreate: true, onUpdate: true }

migrate((app) => {
  const teams = app.findCollectionByNameOrId("teams")

  const projects = new Collection({
    type: "base",
    name: "projects",
    fields: [
      // Cascade (plan D13): deleting a team removes its projects, and with them their
      // settings and chapters.
      { name: "team", type: "relation", required: true, collectionId: teams.id, maxSelect: 1, cascadeDelete: true },
      { name: "name", type: "text", required: true, min: 1, max: 120 },
      { name: "deleted_at", type: "date" },
      VERSION,
      CREATED,
      UPDATED,
    ],
    listRule: IS_TEAM_MEMBER,
    viewRule: IS_TEAM_MEMBER,
    createRule: IS_TEAM_MEMBER + CREATE_NEW,
    // A project never changes team; only the owner moves it to the trash (design 5).
    updateRule: IS_TEAM_MEMBER + UPDATE_GUARDED + " && @request.body.team:isset = false" +
      " && (@request.body.deleted_at:isset = false || team.owner = @request.auth.id)",
    deleteRule: null,
  })
  app.save(projects)

  const settings = new Collection({
    type: "base",
    name: "project_settings",
    fields: [
      { name: "project", type: "relation", required: true, collectionId: projects.id, maxSelect: 1, cascadeDelete: true },
      // Off until a member turns it on (plan D6, design 6.6).
      { name: "analytics_enabled", type: "bool" },
      VERSION,
    ],
    indexes: ["CREATE UNIQUE INDEX idx_project_settings_project ON project_settings (project)"],
    listRule: IS_TEAM_MEMBER_OF_PROJECT,
    viewRule: IS_TEAM_MEMBER_OF_PROJECT,
    // Exactly one row per project, made and removed with it (plan D6).
    createRule: null,
    updateRule: IS_TEAM_MEMBER_OF_PROJECT + UPDATE_GUARDED + " && @request.body.project:isset = false",
    deleteRule: null,
  })
  app.save(settings)

  const chapters = new Collection({
    type: "base",
    name: "chapters",
    fields: [
      { name: "project", type: "relation", required: true, collectionId: projects.id, maxSelect: 1, cascadeDelete: true },
      { name: "title", type: "text", required: true, min: 1, max: 120 },
      // Tab order: a decimal, so a tab can go between two others (plan D4).
      { name: "position", type: "number" },
      { name: "deleted_at", type: "date" },
      VERSION,
      CREATED,
      UPDATED,
    ],
    indexes: ["CREATE INDEX idx_chapters_project ON chapters (project)"],
    listRule: IS_TEAM_MEMBER_OF_PROJECT,
    viewRule: IS_TEAM_MEMBER_OF_PROJECT,
    createRule: IS_TEAM_MEMBER_OF_PROJECT + CREATE_NEW,
    updateRule: IS_TEAM_MEMBER_OF_PROJECT + UPDATE_GUARDED + " && @request.body.project:isset = false",
    deleteRule: null,
  })
  app.save(chapters)
}, (app) => {
  for (const name of ["chapters", "project_settings", "projects"]) {
    app.delete(app.findCollectionByNameOrId(name))
  }
})
