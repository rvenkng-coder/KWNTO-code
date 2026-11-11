/// <reference path="../pb_data/types.d.ts" />
// THROWAWAY: version counter on spike_nodes for the guarded-write follow-up (decision 0002).
migrate((app) => {
  const nodes = app.findCollectionByNameOrId("spike_nodes")
  nodes.fields.add(new NumberField({ name: "version" }))
  app.save(nodes)
}, (app) => {
  const nodes = app.findCollectionByNameOrId("spike_nodes")
  nodes.fields.removeByName("version")
  app.save(nodes)
})
