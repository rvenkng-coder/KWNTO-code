// Deletes expired records in batches without letting one bad record stop the job, which
// would stall the rest at every run. CommonJS so hooks can load it with
// require(`${__hooks}/lib/purge.js`) and Vitest can load it too. Pure: the hook passes the
// way to find a batch and to delete one record.

// findBatch(skipIds) returns the next batch of expired records, none of them in skipIds (an
// empty list means done); remove(record) deletes one; onError(record, error) is told about a
// record that could not be deleted. A failed record is skipped from then on, so the batches
// keep moving; the loop ends when a batch is empty. Returns how many records were deleted.
function purgeInBatches(findBatch, remove, onError) {
  const skipIds = []
  let deleted = 0
  for (;;) {
    const batch = findBatch(skipIds)
    if (batch.length === 0) return deleted
    for (const record of batch) {
      try {
        remove(record)
        deleted++
      } catch (error) {
        skipIds.push(record.id)
        onError(record, error)
      }
    }
  }
}

// The filter text that leaves out the skipped ids, with one bound name per id (`s0`, `s1`, ...),
// and the matching parameters added to `params`.
function withoutSkipped(filter, skipIds, params) {
  let text = filter
  skipIds.forEach((id, i) => {
    text += ` && id != {:s${i}}`
    params["s" + i] = id
  })
  return text
}

module.exports = { purgeInBatches, withoutSkipped }
