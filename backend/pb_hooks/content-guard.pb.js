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
onRecordUpdateRequest((e) => {
  const { guardedTable, changedFields, parseSentVersion } = require(`${__hooks}/lib/content-guard.js`)
  const CONFLICT = "This record was changed by someone else. Reload it and try again."

  // The table name comes from the collection, never from the request.
  const table = guardedTable(e.record.collection().name)
  const sent = parseSentVersion(e.requestInfo().body["version"])
  if (sent === null) {
    throw new BadRequestError("version is required")
  }

  const names = []
  for (const field of e.record.collection().fields) names.push(field.getName())
  const original = e.record.original()
  const changed = changedFields(names, (n) => e.record.get(n), (n) => original.get(n))

  let saved
  e.app.runInTransaction((tx) => {
    const result = tx.db()
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
}, "projects", "project_settings", "chapters", "nodes", "script_lines", "cues", "connections")
