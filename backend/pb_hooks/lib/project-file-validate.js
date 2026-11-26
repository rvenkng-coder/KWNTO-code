// Checks an untrusted project file (security.md 5 "Bad imports"). Written by hand: the hooks
// have no npm packages. CommonJS, loaded through lib/project-file.js.

const { FILE_LIMITS, COLORS, CUE_TYPES, MEDIA_KINDS, MAX_PROBLEMS } = require("./project-file-limits.js")
const { checkLinkUrl } = require("./link-check.js")

const STOP = { stop: true }

function own(object, key) {
  return Object.prototype.hasOwnProperty.call(object, key) ? object[key] : undefined
}

function isObject(value) {
  return value !== null && typeof value === "object" && !Array.isArray(value)
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
const idField = { key: "id", kind: "string", limit: "id", required: true }
const FIELDS = {
  chapters: [
    idField,
    { key: "title", kind: "string", limit: "chapterTitle", required: true },
    { key: "position", kind: "number" },
  ],
  nodes: [
    idField,
    { key: "chapter", kind: "ref", list: "chapters", noun: "chapter" },
    { key: "title", kind: "string", limit: "title" },
    { key: "color", kind: "select", values: COLORS },
    { key: "x", kind: "number" },
    { key: "y", kind: "number" },
    { key: "width", kind: "size", optional: true },
    { key: "height", kind: "size", optional: true },
    // Points into the media list, which is checked later: see checkCovers.
    { key: "cover", kind: "string", limit: "id", optional: true },
  ],
  lines: [
    idField,
    { key: "node", kind: "ref", list: "nodes", noun: "node" },
    { key: "character", kind: "string", limit: "character" },
    { key: "text", kind: "string", limit: "text" },
    { key: "sortOrder", kind: "number" },
  ],
  cues: [
    idField,
    { key: "node", kind: "ref", list: "nodes", noun: "node" },
    { key: "type", kind: "select", values: CUE_TYPES },
    { key: "text", kind: "string", limit: "cueText" },
    { key: "sortOrder", kind: "number" },
  ],
  media: [
    idField,
    { key: "node", kind: "ref", list: "nodes", noun: "node" },
    { key: "title", kind: "string", limit: "mediaTitle" },
    { key: "kind", kind: "select", values: MEDIA_KINDS, allowEmpty: true },
  ],
  links: [
    idField,
    { key: "node", kind: "ref", list: "nodes", noun: "node" },
    { key: "title", kind: "string", limit: "linkTitle" },
    { key: "url", kind: "url", limit: "url", required: true },
  ],
}
// A connection's `from` and `to` are checked by hand in checkLinks, so only these are here.
const CONNECTION_FIELDS = [idField, { key: "label", kind: "string", limit: "label" }]
const CONNECTION_KEYS = ["id", "from", "to", "label"]
const ROOT_KEYS = [
  "format",
  "version",
  "exportedAt",
  "project",
  "chapters",
  "nodes",
  "lines",
  "cues",
  "connections",
  "media",
  "links",
]
const LISTS = ["chapters", "nodes", "lines", "cues", "connections", "media", "links"]
const PROJECT_KEYS = ["name", "startNode"]

function checkKeys(run, path, item, allowed) {
  for (const key of Object.keys(item)) {
    // The key is echoed cut short, so a hostile file cannot fill the message with its own text.
    if (!allowed.includes(key)) run.add(`unknown key "${key.slice(0, 50)}" in ${path}`)
  }
}

function checkString(run, path, value, spec) {
  if (value === undefined || (value === "" && spec.required)) return run.add(`${path} is missing`)
  if (typeof value !== "string") return run.add(`${path} must be a string`)
  const max = run.limits[spec.limit]
  if (value.length > max && codePoints(value) > max) return run.add(`${path} is longer than ${max} characters`)
  return value
}

function checkNumber(run, path, value) {
  if (value === undefined) return run.add(`${path} is missing`)
  if (typeof value !== "number" || !Number.isFinite(value)) return run.add(`${path} must be a number`)
  return value
}

function checkSelect(run, path, value, spec) {
  if (value === undefined) return run.add(`${path} is missing`)
  const allowed = spec.allowEmpty ? ["", ...spec.values] : spec.values
  if (typeof value !== "string" || !allowed.includes(value)) {
    return run.add(`${path} must be one of ${spec.values.join(", ")}`)
  }
  return value
}

function checkRef(run, path, value, spec, ids) {
  if (value === undefined) return run.add(`${path} is missing`)
  if (typeof value !== "string" || !ids[spec.list].has(value))
    return run.add(`${path} is not a ${spec.noun} in the file`)
  return value
}

function checkSize(run, path, value) {
  const number = checkNumber(run, path, value)
  const max = run.limits.side
  if (number !== undefined && (number < 0 || number > max)) return run.add(`${path} must be between 0 and ${max}`)
  return number
}

function checkUrl(run, path, value, spec) {
  const text = checkString(run, path, value, spec)
  if (text === undefined) return undefined
  const checked = checkLinkUrl(text)
  return checked.ok ? checked.url : run.add(`${path} is not a web address`)
}

function checkField(run, path, value, spec, ids) {
  if (spec.kind === "size") return checkSize(run, path, value)
  if (spec.kind === "url") return checkUrl(run, path, value, spec)
  if (spec.kind === "string") return checkString(run, path, value, spec)
  if (spec.kind === "number") return checkNumber(run, path, value)
  if (spec.kind === "select") return checkSelect(run, path, value, spec)
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
    const value = own(item, spec.key)
    if (spec.optional && value === undefined) continue
    copy[spec.key] = checkField(run, `${path}.${spec.key}`, value, spec, ids)
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
      if (isObject(item) && typeof own(item, "id") === "string") found.add(item.id)
    }
    return []
  }
  const copies = []
  list.forEach((item, index) => {
    const path = `${name}[${index}]`
    const copy = checkItem(run, path, item, specs, ids)
    if (name === "connections" && isObject(item)) {
      checkLinks(run, path, item, ids.nodes)
      copy.from = item.from
      copy.to = item.to === undefined ? null : item.to
    }
    if (copy && typeof copy.id === "string") {
      if (found.has(copy.id)) run.add(`duplicate id "${copy.id}" in ${name}`)
      found.add(copy.id)
    }
    copies.push(copy)
  })
  return copies
}

function checkHeader(run, file) {
  if (own(file, "format") !== "kwnto-project") run.add('format must be "kwnto-project"')
  if (own(file, "version") !== 1) run.add("version must be 1")
  checkKeys(run, "the file", file, ROOT_KEYS)
}

function checkProject(run, file) {
  const project = own(file, "project")
  if (!isObject(project)) {
    run.add("project is missing")
    return { name: "", startNode: null }
  }
  checkKeys(run, "project", project, PROJECT_KEYS)
  const spec = { kind: "string", limit: "name", required: true }
  return { name: checkString(run, "project.name", own(project, "name"), spec), startNode: own(project, "startNode") }
}

function checkStartNode(run, start, nodeIds) {
  if (start === undefined) run.add("project.startNode is missing")
  else if (start !== null && !nodeIds.has(start)) run.add("project.startNode is not a node in the file")
}

function checkCovers(run, nodes, mediaIds) {
  nodes.forEach((n, index) => {
    if (n && n.cover !== undefined && !mediaIds.has(n.cover))
      run.add(`nodes[${index}].cover is not a media entry in the file`)
  })
}

function checkExportedAt(run, file) {
  const at = own(file, "exportedAt")
  if (at !== undefined && typeof at !== "string") run.add("exportedAt must be a string")
  return typeof at === "string" ? at : ""
}

function validateObject(run, file) {
  checkHeader(run, file)
  const exportedAt = checkExportedAt(run, file)
  const project = checkProject(run, file)
  const ids = {}
  for (const name of LISTS) ids[name] = new Set()
  const out = { format: "kwnto-project", version: 1, exportedAt, project }
  out.chapters = checkList(run, file, "chapters", { fields: FIELDS.chapters, keys: ["id", "title", "position"] }, ids)
  out.nodes = checkList(
    run,
    file,
    "nodes",
    { fields: FIELDS.nodes, keys: ["id", "chapter", "title", "color", "x", "y", "width", "height", "cover"] },
    ids,
  )
  checkStartNode(run, project.startNode, ids.nodes)
  out.lines = checkList(
    run,
    file,
    "lines",
    { fields: FIELDS.lines, keys: ["id", "node", "character", "text", "sortOrder"] },
    ids,
  )
  out.cues = checkList(
    run,
    file,
    "cues",
    { fields: FIELDS.cues, keys: ["id", "node", "type", "text", "sortOrder"] },
    ids,
  )
  out.connections = checkList(run, file, "connections", { fields: CONNECTION_FIELDS, keys: CONNECTION_KEYS }, ids)
  // The media list is metadata only and import ignores it, so a file without one is fine.
  out.media =
    own(file, "media") === undefined
      ? []
      : checkList(run, file, "media", { fields: FIELDS.media, keys: ["id", "node", "title", "kind"] }, ids)
  checkCovers(run, out.nodes, ids.media)
  // Left out by a project without links, and by files and snapshots made before links were carried.
  if (own(file, "links") !== undefined) {
    out.links = checkList(run, file, "links", { fields: FIELDS.links, keys: ["id", "node", "title", "url"] }, ids)
  }
  return out
}

// Never throws. Accepts the parsed value (or the text, which is parsed here). Stops after 20
// problems. The result's `file` shares nothing with the input.
function validateProjectFile(value, limits) {
  const run = newRun(limits || FILE_LIMITS)
  let file = value
  if (typeof value === "string") {
    try {
      file = JSON.parse(value)
    } catch (error) {
      return { ok: false, problems: ["it is not JSON"] }
    }
  }
  if (!isObject(file)) return { ok: false, problems: ["it is not JSON"] }
  let out = null
  try {
    out = validateObject(run, file)
  } catch (error) {
    if (error !== STOP) run.problems.push("it is not a project file")
  }
  return run.problems.length === 0 ? { ok: true, file: out } : { ok: false, problems: run.problems }
}

module.exports = { validateProjectFile }
