/// <reference path="../pb_data/types.d.ts" />
// Edit links in the content rules (plan 2026-11-20-sharing Task 3, D2). A person who joined
// an edit link has a `link_grants` row; the content rules accept that grant next to team
// membership, so the editor, live events and the offline queue work unchanged.
//
// EDIT_GRANT names ONE grant row with the alias `grant`: every condition about the grant must
// hold in the same row, so a comment grant on one project and an edit grant on another never
// add up. `link.revoked ?= false` is part of it, so revoking a link ends its grants at once,
// and the holder's open live subscription stops too.
//
// Owner-only parts (`team.owner = @request.auth.id`) are untouched: a holder never trashes the
// project or deletes media for good. The up migration puts `(<member> || <grant>)` where the
// membership fragment stood and throws if that fragment is not there exactly once; the down
// migration puts the old text back. Never edit this file after it has run.

const MEMBER_OF_TEAM = "@request.auth.id != '' && team.team_members_via_team.user ?= @request.auth.id"
const MEMBER_OF_PROJECT = "@request.auth.id != '' && project.team.team_members_via_team.user ?= @request.auth.id"

function editGrant(projectField) {
  return "(@request.auth.verified = true" +
    " && @collection.link_grants:grant.user ?= @request.auth.id" +
    ` && @collection.link_grants:grant.project ?= ${projectField}` +
    " && @collection.link_grants:grant.permission ?= 'edit'" +
    " && @collection.link_grants:grant.link.revoked ?= false)"
}

// collection: [membership fragment, project field, the rules to change]. Chapters and nodes
// have no delete rule to change: their delete is locked (`null`), because they are trashed by
// an update and purged by the server (design 6.8), so a grant holder cannot delete them either.
const CHANGES = {
  projects: [MEMBER_OF_TEAM, "id", ["listRule", "viewRule", "updateRule"]],
  project_settings: [MEMBER_OF_PROJECT, "project", ["listRule", "viewRule", "updateRule"]],
  chapters: [MEMBER_OF_PROJECT, "project", ["listRule", "viewRule", "updateRule", "createRule"]],
  nodes: [MEMBER_OF_PROJECT, "project", ["listRule", "viewRule", "updateRule", "createRule"]],
  script_lines: [MEMBER_OF_PROJECT, "project", ["listRule", "viewRule", "updateRule", "createRule", "deleteRule"]],
  cues: [MEMBER_OF_PROJECT, "project", ["listRule", "viewRule", "updateRule", "createRule", "deleteRule"]],
  connections: [MEMBER_OF_PROJECT, "project", ["listRule", "viewRule", "updateRule", "createRule", "deleteRule"]],
  media: [MEMBER_OF_PROJECT, "project", ["listRule", "viewRule", "createRule", "updateRule"]],
}

function replaceOnce(rule, from, to, where) {
  const parts = (rule || "").split(from)
  if (parts.length !== 2) {
    throw new Error(`${where}: the membership fragment is not in the rule exactly once`)
  }
  return parts.join(to)
}

function change(app, makeReplacement) {
  for (const [name, [fragment, projectField, rules]] of Object.entries(CHANGES)) {
    const collection = app.findCollectionByNameOrId(name)
    for (const rule of rules) {
      const [from, to] = makeReplacement(fragment, projectField)
      collection[rule] = replaceOnce(collection[rule], from, to, `${name}.${rule}`)
    }
    app.save(collection)
  }
}

migrate((app) => {
  change(app, (fragment, projectField) => [fragment, `(${fragment} || ${editGrant(projectField)})`])
}, (app) => {
  change(app, (fragment, projectField) => [`(${fragment} || ${editGrant(projectField)})`, fragment])
})
