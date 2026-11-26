/// <reference path="../pb_data/types.d.ts" />
// The admin's incident controls (design 7c, docs/security.md section 9):
// signing one account or every account out, ending a blocked account's sessions, and
// the `admin` entries in the security log for these and for settings changes (design 6.9).
// The sign-outs are superuser-only routes, not manual steps in the dashboard, so they can be
// tested and documented. A block is made by editing `user_status` in the dashboard; a hook
// then ends that user's sessions.
//
// How a session ends in PocketBase 0.40.6 (checked against a running server): a user
// token is signed with the user's token key plus the `users` collection's auth-token
// secret. A new token key ends that user's tokens; a new collection secret ends every
// user's token. Superuser tokens use the `_superusers` secret, so the admin stays in.
//
// The routes live under /api/kwnto/admin/ so the deployment can block that one prefix on
// the public address (docs/developer/backend.md). Every failure is thrown, never caught:
// an admin must never see "done" for a session that was not ended.

routerAdd(
  "POST",
  "/api/kwnto/admin/users/{id}/sign-out",
  (e) => {
    // Hook handlers run in isolated scopes, so helpers are loaded inside the handler.
    const { logEvent } = require(`${__hooks}/lib/security-log.js`)

    let user
    try {
      user = e.app.findRecordById("users", e.request.pathValue("id"))
    } catch (error) {
      throw new NotFoundError("No account with this id.")
    }
    user.refreshTokenKey()
    e.app.save(user)

    logEvent(e.app, "admin", user.id, e.realIP(), { action: "sign-out-user" })
    return e.noContent(204)
  },
  $apis.requireSuperuserAuth(),
)

routerAdd(
  "POST",
  "/api/kwnto/admin/sign-out-all",
  (e) => {
    const { logEvent } = require(`${__hooks}/lib/security-log.js`)

    const users = e.app.findCollectionByNameOrId("users")
    // 50 random characters, the length PocketBase itself gives a new collection's secret.
    users.authToken.secret = $security.randomString(50)
    e.app.save(users)

    logEvent(e.app, "admin", "", e.realIP(), { action: "sign-out-all" })
    return e.noContent(204)
  },
  $apis.requireSuperuserAuth(),
)

// A block does not only refuse the next sign-in: it also ends the account's sessions. The status
// is saved first, so from that moment sign-ins and refreshes are refused (users-signin.pb.js);
// then the token key is renewed. If that fails, the request fails with a message saying
// what to do, instead of reporting a block whose old sessions still work.
// A model hook, so a block made from server code or a batch ends sessions too.
onRecordUpdate((e) => {
  const { logEvent } = require(`${__hooks}/lib/security-log.js`)

  const newlyBlocked = e.record.getBool("blocked") && !e.record.original().getBool("blocked")

  e.next()

  if (!newlyBlocked) {
    return
  }
  const userId = e.record.getString("user")
  try {
    const user = e.app.findRecordById("users", userId)
    user.refreshTokenKey()
    e.app.save(user)
  } catch (error) {
    e.app.logger().error("block: could not end the sessions of a blocked user", "user", userId, "error", String(error))
    throw new ApiError(
      500,
      "The account is blocked, but its sessions could not be ended. Sign it out with the sign-out route.",
    )
  }
  logEvent(e.app, "admin", userId, "", { action: "block", reason: e.record.getString("blocked_reason") })
}, "user_status")

// Admin changes are logged (design 6.9): which fields of a settings table or of a user's
// limits or status changed, with old and new values. These tables hold no secrets.
// Only the admin can write them (their update rules are null), so every change is the
// admin's or server code's.
onRecordUpdate(
  (e) => {
    const { logEvent } = require(`${__hooks}/lib/security-log.js`)

    const before = e.record.original()

    e.next()

    const changes = {}
    const fields = e.record.collection().fields
    for (let i = 0; i < fields.length; i++) {
      const field = fields[i]
      const name = field.getName()
      const oldValue = valueOf(before, name, field.type())
      const newValue = valueOf(e.record, name, field.type())
      if (JSON.stringify(oldValue) !== JSON.stringify(newValue)) {
        changes[name] = { old: oldValue, new: newValue }
      }
    }
    if (Object.keys(changes).length === 0) {
      return
    }

    const collection = e.record.collection().name
    const userId = e.record.collection().fields.getByName("user") ? e.record.getString("user") : ""
    logEvent(e.app, "admin", userId, "", {
      action: "settings",
      collection: collection,
      record: e.record.id,
      changes: changes,
    })

    // A plain JavaScript value for the log: record.get() returns Go types that do not
    // turn into JSON as their value (a json field is raw bytes, a date is an object).
    function valueOf(record, name, type) {
      if (type === "number") return record.getFloat(name)
      if (type === "bool") return record.getBool(name)
      if (type === "json") {
        const text = record.getString(name)
        return text === "" ? null : JSON.parse(text)
      }
      return record.getString(name)
    }
  },
  "system_access",
  "system_storage",
  "system_behavior",
  "user_limits",
  "user_status",
)

// Incident control 6 (docs/security.md section 9): every share link stops working at once.
// A revoked link cannot be un-revoked; people make new links afterwards.
routerAdd(
  "POST",
  "/api/kwnto/admin/share-links/revoke-all",
  (e) => {
    return require(`${__hooks}/lib/share-routes.js`).handleRevokeAll(e)
  },
  $apis.requireSuperuserAuth(),
)
