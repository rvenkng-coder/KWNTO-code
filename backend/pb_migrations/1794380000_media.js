/// <reference path="../pb_data/types.d.ts" />
// The media collection (design section 6.2, ERD; plan 2026-11-16-media-upload Task 2).
// Stores audio, video and image attachments for nodes.

const IS_MEMBER = "@request.auth.id != '' && project.team.team_members_via_team.user ?= @request.auth.id"

migrate((app) => {
  const projects = app.findCollectionByNameOrId("projects")
  const nodes = app.findCollectionByNameOrId("nodes")
  const users = app.findCollectionByNameOrId("users")

  const media = new Collection({
    type: "base",
    name: "media",
    fields: [
      { name: "project", type: "relation", required: true, collectionId: projects.id, maxSelect: 1, cascadeDelete: true },
      { name: "node", type: "relation", required: true, collectionId: nodes.id, maxSelect: 1, cascadeDelete: true },
      { name: "uploader", type: "relation", required: true, collectionId: users.id, maxSelect: 1, cascadeDelete: false },
      { name: "file", type: "file", required: true, protected: true, maxSelect: 1, maxSize: 1073741824, thumbs: ["100x100"] },
      { name: "title", type: "text", max: 120 },
      { name: "kind", type: "select", values: ["audio", "video", "image"], maxSelect: 1 },
      { name: "size_bytes", type: "number", onlyInt: true, min: 0 },
      { name: "created", type: "autodate", onCreate: true },
    ],
    indexes: [
      "CREATE INDEX idx_media_project ON media (project)",
      "CREATE INDEX idx_media_node ON media (node)",
      "CREATE INDEX idx_media_uploader ON media (uploader)",
    ],
    listRule: IS_MEMBER,
    viewRule: IS_MEMBER,
    createRule: IS_MEMBER +
      " && @request.auth.verified = true && @request.body.uploader = @request.auth.id && @request.body.node.project = @request.body.project && @request.body.kind:isset = false && @request.body.size_bytes:isset = false && @request.body.title:isset = false",
    updateRule: null,
    deleteRule: IS_MEMBER,
  })

  app.save(media)
}, (app) => {
  const media = app.findCollectionByNameOrId("media")
  app.delete(media)
})
