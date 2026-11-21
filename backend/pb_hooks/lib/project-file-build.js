// Builds the project file from a project's records (plan 7 D5). CommonJS, loaded through
// lib/project-file.js.

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

module.exports = { buildProjectFile }
