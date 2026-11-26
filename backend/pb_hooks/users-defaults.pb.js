/// <reference path="../pb_data/types.d.ts" />
// Gives every new account its per-user rows (user_preferences, user_limits,
// user_status; design 7c). Runs for every way an account is made: sign-up, the admin
// dashboard, and server code.

onRecordAfterCreateSuccess((e) => {
  // Hook handlers run in isolated scopes, so helpers are loaded inside the handler.
  const { ensureUserRecords } = require(`${__hooks}/lib/user-records.js`)

  // The account is already saved at this point. A failure here must not turn a
  // successful sign-up into an error; the rows are repaired at the next sign-in (users-signin.pb.js).
  try {
    ensureUserRecords(e.app, e.record.id)
  } catch (error) {
    console.error(`user records: could not create the rows of user ${e.record.id}:`, String(error))
  }

  e.next()
}, "users")
