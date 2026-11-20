/// <reference path="../pb_data/types.d.ts" />
// Media belongs to the team lead's storage (design 5 and 6.2, ERD; media-upload follow-up).
// - Quota is charged to the team owner, whoever uploads, so removing a member never frees or
//   strands files: `uploader` only records who uploaded and is now optional, so deleting that
//   account clears it instead of being blocked.
// - A member can only remove media (set `removed_at`, a hide like the trash); the owner can
//   restore it and is the only one who deletes it for good. 1794380000 is never edited.
// - Updates go through the hook in media.pb.js, which refuses every change but `removed_at`
//   and a restore by anyone but the owner.

const IS_MEMBER = "@request.auth.id != '' && project.team.team_members_via_team.user ?= @request.auth.id"
const IS_TEAM_OWNER = "@request.auth.id != '' && project.team.owner = @request.auth.id"

migrate((app) => {
  const media = app.findCollectionByNameOrId("media")
  media.fields.getByName("uploader").required = false
  media.fields.add(new DateField({ name: "removed_at" }))
  media.indexes = [...media.indexes, "CREATE INDEX idx_media_removed ON media (removed_at)"]
  media.updateRule = IS_MEMBER
  media.deleteRule = IS_TEAM_OWNER
  app.save(media)
}, (app) => {
  const media = app.findCollectionByNameOrId("media")
  // Rows with no uploader cannot exist under the old required field.
  app.db().newQuery("DELETE FROM media WHERE uploader = ''").execute()
  media.indexes = media.indexes.filter((sql) => !sql.includes("idx_media_removed"))
  media.fields.removeByName("removed_at")
  media.fields.getByName("uploader").required = true
  media.updateRule = null
  media.deleteRule = IS_MEMBER
  app.save(media)
})
