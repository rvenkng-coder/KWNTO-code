// Turns a validated project file into an import plan, plus the small helpers the routes use.
// CommonJS, loaded through lib/project-file.js.

const { FILE_LIMITS } = require("./project-file-limits.js")

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
  // A node's cover is dropped: the image it names is not in the file.
  const nodes = file.nodes.map((n) => ({
    id: fresh(nodeIds, n.id),
    chapter: chapterIds.get(n.chapter),
    title: n.title,
    color: n.color,
    x: n.x,
    y: n.y,
    width: n.width || 0,
    height: n.height || 0,
  }))
  const lines = file.lines.map((l) => ({
    id: newId(),
    node: nodeIds.get(l.node),
    character: l.character,
    text: l.text,
    sortOrder: l.sortOrder,
  }))
  const cues = file.cues.map((q) => ({
    id: newId(),
    node: nodeIds.get(q.node),
    type: q.type,
    text: q.text,
    sortOrder: q.sortOrder,
  }))
  const connections = file.connections.map((k) => ({
    id: newId(),
    from: nodeIds.get(k.from),
    to: k.to === null ? null : nodeIds.get(k.to),
    label: k.label,
  }))
  const links = (file.links || []).map((l) => ({ id: newId(), node: nodeIds.get(l.node), title: l.title, url: l.url }))
  const start = file.project.startNode
  const startNode = start === null ? null : nodeIds.get(start)
  return { name: file.project.name, startNode, chapters, nodes, lines, cues, connections, links }
}

const IMPORTED = " (imported)"

// The file name offered for a download: letters, digits, - and _ only, so nothing in a
// project name can end up in the header or a path.
function downloadName(name) {
  const base = String(name)
    .replace(/[^A-Za-z0-9_-]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 80)
  return `${base === "" ? "project" : base}.kwnto.json`
}

// The name of the project an import makes, cut so it still fits the name field.
function importedName(name) {
  const room = FILE_LIMITS.name - IMPORTED.length
  return Array.from(name).slice(0, room).join("") + IMPORTED
}

// Bytes of a string in UTF-8, for the size limit (a 5 MB limit is bytes, not characters).
function utf8Length(value) {
  let bytes = 0
  for (const ch of value) {
    const code = ch.codePointAt(0)
    bytes += code < 0x80 ? 1 : code < 0x800 ? 2 : code < 0x10000 ? 3 : 4
  }
  return bytes
}

module.exports = { importPlan, downloadName, importedName, utf8Length }
