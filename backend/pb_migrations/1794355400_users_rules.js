/// <reference path="../pb_data/types.d.ts" />
// Protects docs/security.md section 1.3:
// A user can list and view only their own record; signed-out visitors cannot list users.
migrate((app) => {
  const users = app.findCollectionByNameOrId("users")
  users.listRule = "id = @request.auth.id"
  users.viewRule = "id = @request.auth.id"
  app.save(users)
}, (app) => {
  const users = app.findCollectionByNameOrId("users")
  users.listRule = null
  users.viewRule = null
  app.save(users)
})
