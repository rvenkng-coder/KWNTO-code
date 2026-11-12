/// <reference path="../pb_data/types.d.ts" />
// Team invites (design section 5, ERD): a team owner invites an existing account by
// email; the invite appears only in the invitee's account, who accepts or declines it.
// Made, accepted and declined only by the routes in pb_hooks/teams-invites.pb.js, which
// check who may do it, so the collection API cannot create, change or delete an invite.
// Never edit this file after it has run.

migrate((app) => {
  const users = app.findCollectionByNameOrId("users")
  const teams = app.findCollectionByNameOrId("teams")

  const invites = new Collection({
    type: "base",
    name: "team_invites",
    fields: [
      { name: "team", type: "relation", required: true, collectionId: teams.id, maxSelect: 1, cascadeDelete: true },
      // Deleting either account removes the invite: it means nothing without them.
      { name: "invited_user", type: "relation", required: true, collectionId: users.id, maxSelect: 1, cascadeDelete: true },
      { name: "invited_by", type: "relation", required: true, collectionId: users.id, maxSelect: 1, cascadeDelete: true },
      { name: "status", type: "select", required: true, maxSelect: 1, values: ["pending", "accepted", "declined"] },
      // Copies set by the server when the invite is made (decision D6): the invitee may
      // not read the team or the inviter's account, but must see who invited them where.
      { name: "team_name", type: "text", max: 80 },
      { name: "invited_by_name", type: "text", max: 255 },
      { name: "created", type: "autodate", onCreate: true },
      { name: "updated", type: "autodate", onCreate: true, onUpdate: true },
    ],
    // One pending invite per person per team. A partial index: answered (accepted or
    // declined) invites stay as history, and a declined person may be invited again.
    // The invite route checks for a pending invite first and answers 409; this index is
    // the backstop for any other way of writing the table (the admin dashboard).
    indexes: [
      "CREATE UNIQUE INDEX idx_team_invites_pending ON team_invites (team, invited_user) WHERE status = 'pending'",
      "CREATE INDEX idx_team_invites_invited_user ON team_invites (invited_user)",
    ],
    // Only the invitee sees an invite (decision D7): the owner gets an answer when
    // inviting and later sees the member by name, never a list of pending invitees.
    listRule: "@request.auth.id != '' && invited_user = @request.auth.id",
    viewRule: "@request.auth.id != '' && invited_user = @request.auth.id",
    createRule: null,
    updateRule: null,
    deleteRule: null,
  })
  app.save(invites)
}, (app) => {
  app.delete(app.findCollectionByNameOrId("team_invites"))
})
