/// <reference path="../pb_data/types.d.ts" />
// A node's cover image, shown on top of its card. `cover_media` holds the id of one of the node's
// own image files in `media` ('' means no cover). It is plain text, not a relation, so deleting the
// file for good never has to touch the node; the client ignores an id that is gone or removed.
// Updates need no rule change: the node update rule already lets a member change any field but
// `chapter` and `project`. Never edit this file after it has run.

migrate((app) => {
  const nodes = app.findCollectionByNameOrId("nodes")
  nodes.fields.add(new TextField({ name: "cover_media", max: 40 }))
  app.save(nodes)
}, (app) => {
  const nodes = app.findCollectionByNameOrId("nodes")
  nodes.fields.removeByName("cover_media")
  app.save(nodes)
})
