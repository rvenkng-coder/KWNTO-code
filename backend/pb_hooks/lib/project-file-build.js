// Builds the project file from a project's records (plan 7 D5). CommonJS, loaded through
// lib/project-file.js.

const { checkLinkUrl } = require("./link-check.js")

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
  return value === null || value === undefined ? "" : String(value)
}

function num(value) {
  return value === null || value === undefined ? 0 : Number(value)
}

function chapterEntry(c) {
  return { id: c.id, title: text(c.title), position: num(c.position) }
}

// A size of 0 (the default) and a missing cover are left out. A cover is listed only when it is a
// live image of that node, so it is always one of the file's media entries.
function nodeEntry(n, media) {
  const entry = { id: n.id, chapter: n.chapter, title: text(n.title), color: text(n.color), x: num(n.x), y: num(n.y) }
  if (num(n.width) > 0) entry.width = num(n.width)
  if (num(n.height) > 0) entry.height = num(n.height)
  const cover = media.find((m) => m.id === n.cover_media && m.node === n.id && m.kind === "image" && !m.removed_at)
  if (cover !== undefined) entry.cover = cover.id
  return entry
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

// The links of live nodes, oldest first. An address that is not a web address (possible only through
// an admin edit or a restored backup) is left out, so it cannot make the whole file unreadable.
function linkEntries(links, onLiveNode) {
  return links
    .filter((l) => onLiveNode(l) && checkLinkUrl(l.url).ok)
    .sort(compareBy("created", null))
    .map((l) => ({ id: l.id, node: l.node, title: text(l.title), url: checkLinkUrl(l.url).url }))
}

// records: { project, chapters, nodes, script_lines, cues, connections, media, node_links } as
// plain objects with the stored field names. Leaves out records with deleted_at set, the nodes of
// a trashed chapter and media with removed_at set. `links` is there only when there is one.
function buildProjectFile(records, nowIso) {
  const chapters = records.chapters.filter(isLive)
  const chapterIds = new Set(chapters.map((c) => c.id))
  const nodes = records.nodes.filter((n) => isLive(n) && chapterIds.has(n.chapter))
  const nodeIds = new Set(nodes.map((n) => n.id))
  const onLiveNode = (r) => nodeIds.has(r.node)
  const start = records.project.start_node

  const file = {
    format: "kwnto-project",
    version: 1,
    exportedAt: nowIso,
    project: { name: text(records.project.name), startNode: nodeIds.has(start) ? start : null },
    chapters: chapters.map(chapterEntry).sort(compareBy("position", null)),
    nodes: nodes.map((n) => nodeEntry(n, records.media)).sort(compareBy("id", null)),
    lines: records.script_lines.filter(onLiveNode).map(lineEntry).sort(compareBy("sortOrder", null)),
    cues: records.cues.filter(onLiveNode).map(cueEntry).sort(compareBy("sortOrder", null)),
    // Choices keep the order they were made in (`created`, then id), as the editor shows them; Player Mode reads it.
    connections: records.connections
      .filter((k) => nodeIds.has(k.from_node))
      .sort(compareBy("created", null))
      .map((k) => connectionEntry(k, nodeIds)),
    media: records.media
      .filter((m) => !m.removed_at && onLiveNode(m))
      .map(mediaEntry)
      .sort(compareBy("id", null)),
  }
  const links = linkEntries(records.node_links || [], onLiveNode)
  if (links.length > 0) file.links = links
  return file
}

module.exports = { buildProjectFile }
