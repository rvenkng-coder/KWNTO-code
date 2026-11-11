/// <reference path="../pb_data/types.d.ts" />
// THROWAWAY: version-guarded update for spike_nodes (decision 0002, option 2).
// The client sends the `version` it last read. In ONE transaction this hook
//   1. bumps the stored version with UPDATE ... WHERE version = sent (SQLite decides this under
//      its write lock; no rows changed means someone else saved first -> 409),
//   2. writes the fields the client changed onto the CURRENT record (not the copy loaded when
//      the request started, which may be stale),
// so no save is ever admitted on a version whose data has not landed yet.
// Measured: a version check in the model hooks is not enough. They run outside the save
// transaction, so the bump committed alone and a second writer could slip in (A lost up to 3 of 20).
onRecordUpdateRequest((e) => {
  const sent = e.record.getInt("version")
  const original = e.record.original()
  const changed = []
  for (const f of e.record.collection().fields) {
    const name = f.getName()
    if (["id", "version", "created", "updated"].includes(name)) continue
    if (JSON.stringify(e.record.get(name)) !== JSON.stringify(original.get(name))) changed.push(name)
  }

  let saved
  e.app.runInTransaction((tx) => {
    const res = tx.db()
      .newQuery("UPDATE spike_nodes SET version = version + 1 WHERE id = {:id} AND version = {:v}")
      .bind({ id: e.record.id, v: sent })
      .execute()
    if (res.rowsAffected() === 0) {
      throw new ApiError(409, "version conflict", {})
    }
    saved = tx.findRecordById("spike_nodes", e.record.id)
    for (const name of changed) saved.set(name, e.record.get(name))
    tx.save(saved)
  })
  return e.json(200, saved)
}, "spike_nodes")
