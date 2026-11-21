/// <reference path="../pb_data/types.d.ts" />
// Sends the verification mail the moment an account is created. PocketBase 0.40.6 sends
// nothing on create by itself, and the sign-up screen promises a mail, so without this
// the person had to press "Resend verification email" first. It runs for every way an
// account is made, but only for an unverified account with an email address: an account
// the admin adds as verified needs no mail.
//
// The account is already saved when this runs, so a failure (mail not set up, wrong
// password, Gmail refusing) must never fail the sign-up: it goes to the server console
// (`docker compose logs pocketbase`) and the person can press "Resend verification email".

onRecordAfterCreateSuccess((e) => {
  if (e.record.verified() || !e.record.email()) {
    e.next()
    return
  }

  try {
    $mails.sendRecordVerification(e.app, e.record)
  } catch (error) {
    // The server console is the only place a hook can report this; there is no caller to tell.
    // eslint-disable-next-line no-console
    console.error(`verification mail: could not send to user ${e.record.id}:`, String(error))
  }

  e.next()
}, "users")
