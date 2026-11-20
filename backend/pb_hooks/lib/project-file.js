// The project file (design 10, plan 7 D3 to D6): built, checked and turned into an import
// plan only here, on the server, so export, import, snapshots and the share view share one
// format and one validator. CommonJS so hooks can load it with require(`${__hooks}/lib/
// project-file.js`) and Vitest can load it too. The format is described in
// docs/developer/project-file.md.

// The text lengths and the colour and cue-type lists are the collections' own limits:
// project name from 1794370000_projects_chapters.js (projects.name 120, chapters.title 120);
// node title 200, node colour, line character 80, line text 5000, cue type and cue text
// 2000, connection label 200 from 1794370100_nodes_lines_connections.js; media title 120
// and kind from 1794380000_media.js. The counts and the 5 MB size are plan D5. `id`
// (an id in a file is only a key, so any short string will do) is this file's own limit.
const FILE_LIMITS = {
  maxBytes: 5242880,
  chapters: 200,
  nodes: 2000,
  lines: 20000,
  cues: 10000,
  connections: 10000,
  name: 120,
  title: 200,
  chapterTitle: 120,
  character: 80,
  text: 5000,
  label: 200,
  cueText: 2000,
  mediaTitle: 120,
  id: 100,
}
const COLORS = ['slate', 'red', 'orange', 'amber', 'green', 'teal', 'blue', 'purple']
const CUE_TYPES = ['audio', 'lighting', 'other']
const MEDIA_KINDS = ['audio', 'video', 'image']
const MAX_PROBLEMS = 20

// ---------------------------------------------------------------- building

function isLive(record) {
  return !record.deleted_at
}

function compareBy(first, second) {
  return (a, b) => {
    if (a[first] !== b[first]) return a[first] < b[first] ? -1 : 1
    if (second !== null && a[second] !== b[second]) return a[second] < b[second] ? -1 : 1
    return a.id < b.id ? -1 : a.id > b.id ? 1 : 0
  }
}

function text(value) {
  return value === null || value === undefined ? '' : String(value)
}

function num(value) {
  return value === null || value === undefined ? 0 : Number(value)
}

function chapterEntry(c) {
  return { id: c.id, title: text(c.title), position: num(c.position) }
}

function nodeEntry(n) {
  return { id: n.id, chapter: n.chapter, title: text(n.title), color: text(n.color), x: num(n.x), y: num(n.y) }
}

function lineEntry(l) {
  return { id: l.id, node: l.node, character: text(l.character), text: text(l.text), sortOrder: num(l.sort_order) }
}

function cueEntry(q) {
  return { id: q.id, node: q.node, type: text(q.type), text: text(q.text), sortOrder: num(q.sort_order) }
}

// A choice whose target is trashed or empty keeps its text and points nowhere (`to: null`).
function connectionEntry(k, nodeIds) {
  return { id: k.id, from: k.from_node, to: nodeIds.has(k.to_node) ? k.to_node : null, label: text(k.label) }
}

function mediaEntry(m) {
  return { id: m.id, node: m.node, title: text(m.title), kind: text(m.kind) }
}

// records: { project, chapters, nodes, script_lines, cues, connections, media } as plain
// objects with the stored field names. Leaves out records with deleted_at set, the nodes of
// a trashed chapter and media with removed_at set.
function buildProjectFile(records, nowIso) {
  const chapters = records.chapters.filter(isLive)
  const chapterIds = new Set(chapters.map((c) => c.id))
  const nodes = records.nodes.filter((n) => isLive(n) && chapterIds.has(n.chapter))
  const nodeIds = new Set(nodes.map((n) => n.id))
  const onLiveNode = (r) => nodeIds.has(r.node)
  const start = records.project.start_node

  return {
    format: 'kwnto-project',
    version: 1,
    exportedAt: nowIso,
    project: { name: text(records.project.name), startNode: nodeIds.has(start) ? start : null },
    chapters: chapters.map(chapterEntry).sort(compareBy('position', null)),
    nodes: nodes.map(nodeEntry).sort(compareBy('id', null)),
    lines: records.script_lines.filter(onLiveNode).map(lineEntry).sort(compareBy('sortOrder', null)),
    cues: records.cues.filter(onLiveNode).map(cueEntry).sort(compareBy('sortOrder', null)),
    connections: records.connections.filter((k) => nodeIds.has(k.from_node)).map((k) => connectionEntry(k, nodeIds)).sort(compareBy('id', null)),
    media: records.media.filter((m) => !m.removed_at && onLiveNode(m)).map(mediaEntry).sort(compareBy('id', null)),
  }
}

// ---------------------------------------------------------------- validating

const STOP = { stop: true }

function own(object, key) {
  return Object.prototype.hasOwnProperty.call(object, key) ? object[key] : undefined
}

function isObject(value) {
  return value !== null && typeof value === 'object' && !Array.isArray(value)
}

function codePoints(value) {
  return Array.from(value).length
}

// One run of the validator: collects problems and stops the whole run at the 20th.
function newRun(limits) {
  const problems = []
  return {
    problems,
    limits,
    add(message) {
      problems.push(message)
      if (problems.length >= MAX_PROBLEMS) throw STOP
    },
  }
}

// Each field is one spec: key, kind, and what the kind needs.
const idField = { key: 'id', kind: 'string', limit: 'id', required: true }
const FIELDS = {
  chapters: [idField, { key: 'title', kind: 'string', limit: 'chapterTitle', required: true }, { key: 'position', kind: 'number' }],
  nodes: [
    idField,
    { key: 'chapter', kind: 'ref', list: 'chapters', noun: 'chapter' },
    { key: 'title', kind: 'string', limit: 'title' },
    { key: 'color', kind: 'select', values: COLORS },
    { key: 'x', kind: 'number' },
    { key: 'y', kind: 'number' },
  ],
  lines: [
    idField,
    { key: 'node', kind: 'ref', list: 'nodes', noun: 'node' },
    { key: 'character', kind: 'string', limit: 'character' },
    { key: 'text', kind: 'string', limit: 'text' },
    { key: 'sortOrder', kind: 'number' },
  ],
  cues: [
    idField,
    { key: 'node', kind: 'ref', list: 'nodes', noun: 'node' },
    { key: 'type', kind: 'select', values: CUE_TYPES },
    { key: 'text', kind: 'string', limit: 'cueText' },
    { key: 'sortOrder', kind: 'number' },
  ],
  media: [
    idField,
    { key: 'node', kind: 'ref', list: 'nodes', noun: 'node' },
    { key: 'title', kind: 'string', limit: 'mediaTitle' },
    { key: 'kind', kind: 'select', values: MEDIA_KINDS, allowEmpty: true },
  ],
}
// A connection's `from` and `to` are checked by hand in checkLinks, so only these are here.
const CONNECTION_FIELDS = [idField, { key: 'label', kind: 'string', limit: 'label' }]
const CONNECTION_KEYS = ['id', 'from', 'to', 'label']
const ROOT_KEYS = ['format', 'version', 'exportedAt', 'project', 'chapters', 'nodes', 'lines', 'cues', 'connections', 'media']
const LISTS = ['chapters', 'nodes', 'lines', 'cues', 'connections', 'media']
const PROJECT_KEYS = ['name', 'startNode']

function checkKeys(run, path, item, allowed) {
  for (const key of Object.keys(item)) {
    if (!allowed.includes(key)) run.add(`unknown key "${key}" in ${path}`)
  }
}

function checkString(run, path, value, spec) {
  if (value === undefined || (value === '' && spec.required)) return run.add(`${path} is missing`)
  if (typeof value !== 'string') return run.add(`${path} must be a string`)
  const max = run.limits[spec.limit]
  if (value.length > max && codePoints(value) > max) return run.add(`${path} is longer than ${max} characters`)
  return value
}

function checkNumber(run, path, value) {
  if (value === undefined) return run.add(`${path} is missing`)
  if (typeof value !== 'number' || !Number.isFinite(value)) return run.add(`${path} must be a number`)
  return value
}

function checkSelect(run, path, value, spec) {
  if (value === undefined) return run.add(`${path} is missing`)
  const allowed = spec.allowEmpty ? ['', ...spec.values] : spec.values
  if (typeof value !== 'string' || !allowed.includes(value)) {
    return run.add(`${path} must be one of ${spec.values.join(', ')}`)
  }
  return value
}

function checkRef(run, path, value, spec, ids) {
  if (value === undefined) return run.add(`${path} is missing`)
  if (typeof value !== 'string' || !ids[spec.list].has(value)) return run.add(`${path} is not a ${spec.noun} in the file`)
  return value
}

function checkField(run, path, value, spec, ids) {
  if (spec.kind === 'string') return checkString(run, path, value, spec)
  if (spec.kind === 'number') return checkNumber(run, path, value)
  if (spec.kind === 'select') return checkSelect(run, path, value, spec)
  return checkRef(run, path, value, spec, ids)
}

// A connection goes to a node of the file, or nowhere (`to: null`, an empty choice).
function checkLinks(run, path, c, nodeIds) {
  if (c.from === undefined) run.add(`${path}.from is missing`)
  else if (!nodeIds.has(c.from)) run.add(`${path}.from is not a node in the file`)
  if (c.to === undefined) run.add(`${path}.to is missing`)
  else if (c.to !== null && !nodeIds.has(c.to)) run.add(`${path}.to is not a node in the file`)
}

// Copies only the known keys into a fresh object.
function checkItem(run, path, item, specs, ids) {
  if (!isObject(item)) return run.add(`${path} is missing`)
  checkKeys(run, path, item, specs.keys)
  const copy = {}
  for (const spec of specs.fields) {
    copy[spec.key] = checkField(run, `${path}.${spec.key}`, own(item, spec.key), spec, ids)
  }
  return copy
}

// Checks one list of the file and collects its ids for the lists that point at it.
function checkList(run, file, name, specs, ids) {
  const list = own(file, name)
  if (!Array.isArray(list)) {
    run.add(`${name} is missing`)
    return []
  }
  const limit = run.limits[name]
  const found = ids[name]
  if (list.length > limit) {
    run.add(`too many ${name} (${list.length}, at most ${limit})`)
    for (const item of list) {
      if (isObject(item) && typeof own(item, 'id') === 'string') found.add(item.id)
    }
    return []
  }
  const copies = []
  list.forEach((item, index) => {
    const path = `${name}[${index}]`
    const copy = checkItem(run, path, item, specs, ids)
    if (name === 'connections' && isObject(item)) {
      checkLinks(run, path, item, ids.nodes)
      copy.from = item.from
      copy.to = item.to === undefined ? null : item.to
    }
    if (copy && typeof copy.id === 'string') {
      if (found.has(copy.id)) run.add(`duplicate id "${copy.id}" in ${name}`)
      found.add(copy.id)
    }
    copies.push(copy)
  })
  return copies
}

function checkHeader(run, file) {
  if (own(file, 'format') !== 'kwnto-project') run.add('format must be "kwnto-project"')
  if (own(file, 'version') !== 1) run.add('version must be 1')
  checkKeys(run, 'the file', file, ROOT_KEYS)
}

function checkProject(run, file) {
  const project = own(file, 'project')
  if (!isObject(project)) {
    run.add('project is missing')
    return { name: '', startNode: null }
  }
  checkKeys(run, 'project', project, PROJECT_KEYS)
  const spec = { kind: 'string', limit: 'name', required: true }
  return { name: checkString(run, 'project.name', own(project, 'name'), spec), startNode: own(project, 'startNode') }
}

function checkStartNode(run, start, nodeIds) {
  if (start === undefined) run.add('project.startNode is missing')
  else if (start !== null && !nodeIds.has(start)) run.add('project.startNode is not a node in the file')
}

function checkExportedAt(run, file) {
  const at = own(file, 'exportedAt')
  if (at !== undefined && typeof at !== 'string') run.add('exportedAt must be a string')
  return typeof at === 'string' ? at : ''
}

function validateObject(run, file) {
  checkHeader(run, file)
  const exportedAt = checkExportedAt(run, file)
  const project = checkProject(run, file)
  const ids = {}
  for (const name of LISTS) ids[name] = new Set()
  const out = { format: 'kwnto-project', version: 1, exportedAt, project }
  out.chapters = checkList(run, file, 'chapters', { fields: FIELDS.chapters, keys: ['id', 'title', 'position'] }, ids)
  out.nodes = checkList(run, file, 'nodes', { fields: FIELDS.nodes, keys: ['id', 'chapter', 'title', 'color', 'x', 'y'] }, ids)
  checkStartNode(run, project.startNode, ids.nodes)
  out.lines = checkList(run, file, 'lines', { fields: FIELDS.lines, keys: ['id', 'node', 'character', 'text', 'sortOrder'] }, ids)
  out.cues = checkList(run, file, 'cues', { fields: FIELDS.cues, keys: ['id', 'node', 'type', 'text', 'sortOrder'] }, ids)
  out.connections = checkList(run, file, 'connections', { fields: CONNECTION_FIELDS, keys: CONNECTION_KEYS }, ids)
  // The media list is metadata only and import ignores it, so a file without one is fine.
  out.media = own(file, 'media') === undefined ? [] : checkList(run, file, 'media', { fields: FIELDS.media, keys: ['id', 'node', 'title', 'kind'] }, ids)
  return out
}

// Never throws. Accepts the parsed value (or the text, which is parsed here). Stops after 20
// problems. The result's `file` shares nothing with the input.
function validateProjectFile(value, limits) {
  const run = newRun(limits || FILE_LIMITS)
  let file = value
  if (typeof value === 'string') {
    try {
      file = JSON.parse(value)
    } catch (error) {
      return { ok: false, problems: ['it is not JSON'] }
    }
  }
  if (!isObject(file)) return { ok: false, problems: ['it is not JSON'] }
  let out = null
  try {
    out = validateObject(run, file)
  } catch (error) {
    if (error !== STOP) run.problems.push('it is not a project file')
  }
  return run.problems.length === 0 ? { ok: true, file: out } : { ok: false, problems: run.problems }
}

// ---------------------------------------------------------------- importing

// Gives every record a new id (newId() makes a fresh 15-character one) and maps every
// reference (chapter, node, from, to, startNode) to the new ids. The file's own ids are
// kept only as keys of a Map, so no old id appears in the plan. `file` must have passed
// validateProjectFile.
function importPlan(file, newId) {
  const chapterIds = new Map()
  const nodeIds = new Map()
  const fresh = (map, old) => {
    const id = newId()
    map.set(old, id)
    return id
  }
  const chapters = file.chapters.map((c) => ({ id: fresh(chapterIds, c.id), title: c.title, position: c.position }))
  const nodes = file.nodes.map((n) => ({ id: fresh(nodeIds, n.id), chapter: chapterIds.get(n.chapter), title: n.title, color: n.color, x: n.x, y: n.y }))
  const lines = file.lines.map((l) => ({ id: newId(), node: nodeIds.get(l.node), character: l.character, text: l.text, sortOrder: l.sortOrder }))
  const cues = file.cues.map((q) => ({ id: newId(), node: nodeIds.get(q.node), type: q.type, text: q.text, sortOrder: q.sortOrder }))
  const connections = file.connections.map((k) => ({
    id: newId(),
    from: nodeIds.get(k.from),
    to: k.to === null ? null : nodeIds.get(k.to),
    label: k.label,
  }))
  const start = file.project.startNode
  return { name: file.project.name, startNode: start === null ? null : nodeIds.get(start), chapters, nodes, lines, cues, connections }
}

module.exports = { FILE_LIMITS, buildProjectFile, validateProjectFile, importPlan }
