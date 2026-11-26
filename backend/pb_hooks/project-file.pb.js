/// <reference path="../pb_data/types.d.ts" />
// Project files (design 10, plan 7 D4 to D6, docs/developer/project-file.md). The file is
// built and checked only here, with lib/project-file.js; the browser downloads and uploads it.
//
//   GET  /api/kwnto/projects/{id}/export   a member gets the file; anyone else the same 404
//   POST /api/kwnto/teams/{id}/import      a verified member makes a new project from a file
//
// An import is untrusted input (security.md section 5): the size is checked before the body
// is parsed, the whole file is validated before anything is written, and the project is made
// in one transaction, so a refused or failed import leaves nothing behind.

routerAdd(
  "GET",
  "/api/kwnto/projects/{id}/export",
  (e) => {
    // Hook handlers run in isolated scopes, so helpers are loaded inside the handler.
    const { buildProjectFile, downloadName } = require(`${__hooks}/lib/project-file.js`)
    const { loadProjectRecords } = require(`${__hooks}/lib/project-records.js`)

    // An unknown id and a project of another team look the same. The id is a bound parameter
    // or a record lookup, never part of a query text.
    const projectId = e.request.pathValue("id")
    let records = null
    try {
      const project = e.app.findRecordById("projects", projectId)
      const member = e.app.findRecordsByFilter("team_members", "team = {:team} && user = {:user}", "", 1, 0, {
        team: project.getString("team"),
        user: e.auth.id,
      })
      if (member.length > 0) {
        records = loadProjectRecords(e.app, projectId)
      }
    } catch (error) {
      // Only "no such project" is a 404; any other failure is a real error and must not be hidden.
      if (!String(error).includes("no rows")) {
        throw error
      }
      records = null
    }
    if (records === null) {
      throw new NotFoundError("No project with this id.")
    }

    const file = buildProjectFile(records, new Date().toISOString().replace("T", " "))
    e.response.header().set("Content-Disposition", `attachment; filename="${downloadName(records.project.name)}"`)
    // Written with JSON.stringify, not e.json(): e.json() serialises a JS object through Go and
    // shuffles its keys, and the file should read in the documented order.
    e.response.header().set("Content-Type", "application/json; charset=UTF-8")
    return e.string(200, JSON.stringify(file))
  },
  $apis.requireAuth("users"),
)

routerAdd(
  "POST",
  "/api/kwnto/teams/{id}/import",
  (e) => {
    const { FILE_LIMITS, validateProjectFile, importPlan, importedName, utf8Length } = require(
      `${__hooks}/lib/project-file.js`,
    )
    const { createImportedProject } = require(`${__hooks}/lib/project-import.js`)
    const { importLimitReached } = require(`${__hooks}/lib/import-limit.js`)
    const { logEvent } = require(`${__hooks}/lib/security-log.js`)
    // Constants of this file are not visible inside a handler (isolated scopes), so they live here.
    const TOO_LARGE = "This file is larger than the 5 MB import limit."
    const NOT_A_PROJECT = "This file is not a KWNTO project: "

    if (!e.auth.verified()) {
      throw new ForbiddenError("Verify your email address first.")
    }
    const teamId = e.request.pathValue("id")
    const membership = e.app.findRecordsByFilter("team_members", "team = {:team} && user = {:user}", "", 1, 0, {
      team: teamId,
      user: e.auth.id,
    })
    if (membership.length === 0) {
      throw new NotFoundError("No team with this id.")
    }

    // An import can hold the only write connection for seconds, so the number an hour is limited.
    // Only accepted attempts are logged: a refusal by the limit does not extend the wait.
    if (importLimitReached(e.app, e.auth.id)) {
      throw new ApiError(429, "Too many imports. Try again later.", {})
    }
    logEvent(e.app, "import", e.auth.id, e.realIP(), { teamId: teamId })

    // The size is checked before anything is parsed: first the length the client declared
    // (the server never delivers more than that), then the bytes actually read, never more
    // than one byte past the limit.
    const max = FILE_LIMITS.maxBytes
    if (e.request.contentLength > max) {
      throw new ApiError(413, TOO_LARGE, {})
    }
    const raw = toString(e.request.body, max + 1)
    if (utf8Length(raw) > max) {
      throw new ApiError(413, TOO_LARGE, {})
    }

    const checked = validateProjectFile(raw, FILE_LIMITS)
    if (!checked.ok) {
      throw new BadRequestError(NOT_A_PROJECT + checked.problems[0])
    }

    const plan = importPlan(checked.file, () =>
      $security.randomStringWithAlphabet(15, "abcdefghijklmnopqrstuvwxyz0123456789"),
    )
    let projectId = ""
    try {
      e.app.runInTransaction((tx) => {
        projectId = createImportedProject(tx, teamId, e.auth.id, importedName(plan.name), plan)
      })
    } catch (error) {
      // The file passed the checks but the database refused a record (for example two
      // connections between the same two nodes). Everything was rolled back.
      e.app.logger().error("project import refused by the database", "error", String(error))
      throw new BadRequestError(NOT_A_PROJECT + "a record in it was refused")
    }
    return e.json(200, { projectId: projectId })
  },
  $apis.requireAuth("users"),
)
