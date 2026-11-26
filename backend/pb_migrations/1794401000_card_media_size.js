/// <reference path="../pb_data/types.d.ts" />
// The size of the media tiles on a card, in pixels, as an account preference like the card font size
// (0 means the default size, which is how every existing row stays). Updates need no rule change.
// Never edit this file after it has run.

migrate((app) => {
  const preferences = app.findCollectionByNameOrId("user_preferences")
  preferences.fields.add(new NumberField({ name: "card_media_size", min: 0, max: 400 }))
  app.save(preferences)
}, (app) => {
  const preferences = app.findCollectionByNameOrId("user_preferences")
  preferences.fields.removeByName("card_media_size")
  app.save(preferences)
})
