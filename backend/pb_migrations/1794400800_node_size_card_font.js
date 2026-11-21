/// <reference path="../pb_data/types.d.ts" />
// Resizable node cards and a card font size. A node gets a `width` and a `height` (0 means the
// default size, which is how every existing node stays); the account's `user_preferences` row gets
// `card_font_size` (0 means the default size). Updates need no rule change: the node update rule
// already lets a member change any field but `chapter` and `project`. Never edit this file after
// it has run.

migrate((app) => {
  const nodes = app.findCollectionByNameOrId("nodes")
  nodes.fields.add(new NumberField({ name: "width", min: 0, max: 2000 }))
  nodes.fields.add(new NumberField({ name: "height", min: 0, max: 2000 }))
  app.save(nodes)

  const preferences = app.findCollectionByNameOrId("user_preferences")
  preferences.fields.add(new NumberField({ name: "card_font_size", min: 0, max: 48 }))
  app.save(preferences)
}, (app) => {
  const nodes = app.findCollectionByNameOrId("nodes")
  nodes.fields.removeByName("width")
  nodes.fields.removeByName("height")
  app.save(nodes)

  const preferences = app.findCollectionByNameOrId("user_preferences")
  preferences.fields.removeByName("card_font_size")
  app.save(preferences)
})
