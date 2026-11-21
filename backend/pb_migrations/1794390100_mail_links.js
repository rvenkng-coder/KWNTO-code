/// <reference path="../pb_data/types.d.ts" />
// Plan 6 D9, design 7c: PocketBase's default verification and reset mails link to its own
// dashboard (`{APP_URL}/_/#/auth/...`), which the proxy blocks on the public address. These
// templates link into the app instead (`#/verify/<token>`, `#/reset/<token>`), where the two
// screens of the auth feature finish the job. It runs on every backend, since dev mail would
// otherwise also point at the dashboard. The email-change template is not used and is left
// alone. Never edit this file after it has run.
migrate((app) => {
  const users = app.findCollectionByNameOrId("users")
  users.verificationTemplate.subject = "Verify your KWNTO email"
  users.verificationTemplate.body =
    '<p>Hello,</p><p>Confirm your email for KWNTO: <a href="{APP_URL}/#/verify/{TOKEN}">verify my email</a>.</p><p>If you did not sign up, ignore this mail.</p>'
  users.resetPasswordTemplate.subject = "Reset your KWNTO password"
  users.resetPasswordTemplate.body =
    '<p>Hello,</p><p>You asked to reset your KWNTO password: <a href="{APP_URL}/#/reset/{TOKEN}">set a new password</a>.</p><p>If you did not ask for this, ignore this mail.</p>'
  app.save(users)
}, (app) => {
  // PocketBase 0.40.6's own defaults, as they were before this migration (read from a fresh backend).
  const users = app.findCollectionByNameOrId("users")
  users.verificationTemplate.subject = "Verify your {APP_NAME} email"
  users.verificationTemplate.body =
    "<p>Hello,</p>\n<p>Thank you for joining us at {APP_NAME}.</p>\n<p>Click on the button below to verify your email address.</p>\n<p>\n  <a class=\"btn\" href=\"{APP_URL}/_/#/auth/confirm-verification/{TOKEN}\" target=\"_blank\" rel=\"noopener\">Verify</a>\n</p>\n<p><i>If you didn't recently register, please ignore this email.</i></p>\n<p>\n  Thanks,<br/>\n  {APP_NAME} team\n</p>"
  users.resetPasswordTemplate.subject = "Reset your {APP_NAME} password"
  users.resetPasswordTemplate.body =
    "<p>Hello,</p>\n<p>Click on the button below to reset your password.</p>\n<p>\n  <a class=\"btn\" href=\"{APP_URL}/_/#/auth/confirm-password-reset/{TOKEN}\" target=\"_blank\" rel=\"noopener\">Reset password</a>\n</p>\n<p><i>If you didn't ask to reset your password, please ignore this email.</i></p>\n<p>\n  Thanks,<br/>\n  {APP_NAME} team\n</p>"
  app.save(users)
})
