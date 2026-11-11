/// <reference path="../pb_data/types.d.ts" />
// THROWAWAY spike collections for the real-time measurements (Task 3).
migrate((app) => {
  const rule = '@request.auth.id != ""'
  const rules = { listRule: rule, viewRule: rule, createRule: rule, updateRule: rule, deleteRule: rule }

  const nodes = new Collection({
    type: "base",
    name: "spike_nodes",
    ...rules,
    fields: [
      { type: "text", name: "project" },
      { type: "text", name: "title" },
      { type: "text", name: "color" },
      { type: "number", name: "x" },
      { type: "number", name: "y" },
      { type: "autodate", name: "updated", onCreate: true, onUpdate: true },
    ],
  })
  app.save(nodes)

  const lines = new Collection({
    type: "base",
    name: "spike_lines",
    ...rules,
    fields: [
      { type: "text", name: "project" },
      { type: "relation", name: "node", collectionId: nodes.id, maxSelect: 1 },
      { type: "text", name: "text" },
      { type: "number", name: "sort_order" },
      { type: "autodate", name: "updated", onCreate: true, onUpdate: true },
    ],
  })
  app.save(lines)
}, (app) => {
  for (const name of ["spike_lines", "spike_nodes"]) {
    try { app.delete(app.findCollectionByNameOrId(name)) } catch (_) { /* already gone */ }
  }
})
