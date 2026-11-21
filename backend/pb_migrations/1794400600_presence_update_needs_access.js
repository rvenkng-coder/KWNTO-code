/// <reference path="../pb_data/types.d.ts" />
// Presence rows can only be updated by someone who may still edit the project (plan
// 2026-11-20-sharing, whole-branch review finding L1). The update rule only said "your own row",
// so an edit-link holder whose link was revoked, or a member who left the team, could keep their
// row alive and move it between nodes. The access part is the one the create rule starts with.
// Delete stays "your own row": removing it hurts nobody. The down migration removes the prefix.
// Never edit this file after it has run.

const OWN_ROW = "user = @request.auth.id && "

function access(createRule) {
  const at = createRule.indexOf(" && @request.body.user = ")
  if (at < 0) throw new Error("presence.createRule: the access part was not found")
  return createRule.slice(0, at)
}

migrate((app) => {
  const presence = app.findCollectionByNameOrId("presence")
  const update = String(presence.updateRule)
  if (!update.startsWith(OWN_ROW)) throw new Error("presence.updateRule is not the expected text")
  presence.updateRule = access(String(presence.createRule)) + " && " + update
  app.save(presence)
}, (app) => {
  const presence = app.findCollectionByNameOrId("presence")
  const prefix = access(String(presence.createRule)) + " && "
  const update = String(presence.updateRule)
  if (!update.startsWith(prefix)) throw new Error("presence.updateRule does not start with the access part")
  presence.updateRule = update.slice(prefix.length)
  app.save(presence)
})
