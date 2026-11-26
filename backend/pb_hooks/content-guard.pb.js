/// <reference path="../pb_data/types.d.ts" />
// The version-guarded update of every content collection (decision 0002, option 2;
// plan D3; docs/developer/backend.md "Guarded writes"). The client sends the `version`
// it last read together with the fields it changed. In ONE transaction this hook
//   1. bumps the stored version with UPDATE ... WHERE version = sent (SQLite decides this
//      under its write lock; no row changed means someone else saved first: 409),
//   2. writes only the changed fields onto the freshly read record and saves it,
// so no save is admitted on a version whose data has not landed yet. Measured in the
// spike: a version check in the model hooks loses edits, because those run outside the
// save transaction; only a hook on the update request is correct.
//
// The update rule has already run when this hook starts (proved by the outsider tests in
// tests/rules/chapters.rules.test.ts), so it does not check access itself. The rule also
// requires `version` in the body; a value that is not a whole number from 0 is a 400.
// Collections that do not exist yet (Task 6) are simply never matched.
onRecordUpdateRequest(
  (e) => {
    const { guardedTable, changedFields, parseSentVersion } = require(`${__hooks}/lib/content-guard.js`)
    const CONFLICT = "This record was changed by someone else. Reload it and try again."

    // The table name comes from the collection, never from the request.
    const table = guardedTable(e.record.collection().name)
    const sent = parseSentVersion(e.requestInfo().body["version"])
    if (sent === null) {
      throw new BadRequestError("version is required")
    }

    // The trash time is the server's own (design 6.8, plan D11): a browser with a wrong clock,
    // or a hand-made request, must not date work far back and get it purged. Done before the
    // changed fields are found, so the stamped value is what gets copied. `deleted_at` exists
    // on projects, chapters and nodes only; its restore (an empty value) stays empty.
    if (Object.prototype.hasOwnProperty.call(e.requestInfo().body, "deleted_at")) {
      const { serverDeletedAt } = require(`${__hooks}/lib/trash.js`)
      const nowIso = new Date().toISOString().replace("T", " ")
      // The body value is a Go-backed object here, not a JS string, so an empty value does not
      // equal '' until it is turned into text; null and undefined are left for the helper.
      const sentValue = e.requestInfo().body["deleted_at"]
      const sentText = sentValue === null || sentValue === undefined ? sentValue : String(sentValue)
      e.record.set("deleted_at", serverDeletedAt(sentText, nowIso))
    }

    // A node comes back with its chapter, never before it (design 6.8, plan 7 D11): restoring a
    // node whose chapter is still in the trash would leave it hidden and out of the export. The
    // trash panel says the same; this is the check for a request that skips the panel.
    if (
      e.record.collection().name === "nodes" &&
      e.record.original().getString("deleted_at") !== "" &&
      e.record.getString("deleted_at") === ""
    ) {
      const chapter = e.app.findRecordById("chapters", e.record.getString("chapter"))
      if (chapter.getString("deleted_at") !== "") {
        throw new BadRequestError("Restore the chapter " + chapter.getString("title") + " first.")
      }
    }

    const names = []
    for (const field of e.record.collection().fields) names.push(field.getName())
    const original = e.record.original()
    const changed = changedFields(
      names,
      (n) => e.record.get(n),
      (n) => original.get(n),
    )

    let saved
    e.app.runInTransaction((tx) => {
      const result = tx
        .db()
        .newQuery(`UPDATE ${table} SET version = version + 1 WHERE id = {:id} AND version = {:version}`)
        .bind({ id: e.record.id, version: sent })
        .execute()
      if (result.rowsAffected() === 0) {
        throw new ApiError(409, CONFLICT, {})
      }
      saved = tx.findRecordById(table, e.record.id)
      for (const name of changed) saved.set(name, e.record.get(name))
      tx.save(saved)
    })
    return e.json(200, saved)
  },
  "projects",
  "project_settings",
  "chapters",
  "nodes",
  "script_lines",
  "cues",
  "connections",
)
