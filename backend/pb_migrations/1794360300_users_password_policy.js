/// <reference path="../pb_data/types.d.ts" />
// Raises the users password minimum to 10 characters (design 7c, docs/security.md
// section 3). The full rules (letter, number, not common) are in the users-signup hook;
// this field minimum is the floor PocketBase itself enforces on every path that sets a
// password, including the password-reset form and the admin dashboard, so it still
// holds if a hook is ever missing. Never edit this file after it has run.
//
// Emails stay private: the email field is left as it is. Each account's own
// `emailVisibility` flag defaults to false, and the users list and view rules
// (1794355400_users_rules.js) show a record only to its owner.
migrate((app) => {
  const users = app.findCollectionByNameOrId("users")
  users.fields.getByName("password").min = 10
  app.save(users)
}, (app) => {
  const users = app.findCollectionByNameOrId("users")
  users.fields.getByName("password").min = 8 // PocketBase's default
  app.save(users)
})
