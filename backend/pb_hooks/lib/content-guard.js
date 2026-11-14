// The pure parts of the version-guarded update (decision 0002, option 2; plan D3).
// CommonJS so hooks can load it with require(`${__hooks}/lib/content-guard.js`).
// The hook itself is content-guard.pb.js.

// The content collections whose updates must carry the version they were based on.
const GUARDED = ['projects', 'project_settings', 'chapters', 'nodes', 'script_lines', 'cues', 'connections']

// Fields the guard never copies from the request: the server owns them.
const SKIP = ['id', 'version', 'created', 'updated']

// The guard puts the table name into its SQL, so only a known name may come back.
function guardedTable(name) {
  if (!GUARDED.includes(name)) {
    throw new Error(`not a guarded collection: ${name}`)
  }
  return name
}

// The fields whose value in the request differs from the stored one. read(n) and
// readOriginal(n) return a field's value; values are compared as JSON, so equal
// objects and lists are unchanged.
function changedFields(fieldNames, read, readOriginal) {
  const changed = []
  for (const name of fieldNames) {
    if (SKIP.includes(name)) continue
    if (JSON.stringify(read(name)) !== JSON.stringify(readOriginal(name))) changed.push(name)
  }
  return changed
}

// The version the client sent, or null when it is not a whole number from 0.
function parseSentVersion(value) {
  return Number.isInteger(value) && value >= 0 ? value : null
}

module.exports = { GUARDED, guardedTable, changedFields, parseSentVersion }
