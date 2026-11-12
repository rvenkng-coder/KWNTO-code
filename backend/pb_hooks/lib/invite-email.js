// The email typed into an invite (design section 5), as the invite route uses it.
// CommonJS so hooks can load it with require(`${__hooks}/lib/invite-email.js`).
// Pure, so Vitest tests it (tests/hooks/invite-email.unit.test.ts).

// The address as typed, without stray spaces; its letter case is kept, because two
// accounts may differ only in case (chooseAccountIndex). Anything that is not a string
// (a missing body, a number) matches no account.
function typedEmail(value) {
  return typeof value === "string" ? value.trim() : ""
}

// Emails are typed by hand, so capitals must not hide an account.
function normalisedEmail(value) {
  return typedEmail(value).toLowerCase()
}

// Which of the accounts found ignoring case gets the invite. PocketBase 0.40.6 allows
// two accounts whose emails differ only in letter case, so the lookup may find two. The
// address exactly as typed wins; a single match is used whatever its case; otherwise
// (several matches, none exact, or none) -1, which the route answers like an unknown
// email, so the ambiguity is not revealed. Never "the first row": someone who registers
// a case variant of a real address must not capture that person's invites.
function chooseAccountIndex(storedEmails, typed) {
  const exact = storedEmails.indexOf(typed)
  if (exact !== -1) {
    return exact
  }
  return storedEmails.length === 1 ? 0 : -1
}

// What the security log keeps of the address: only the domain. The full address is
// never stored, so the log cannot become a list of the emails that have accounts.
function emailDomain(email) {
  const at = email.lastIndexOf("@")
  return at === -1 ? "" : email.slice(at + 1)
}

module.exports = { typedEmail, normalisedEmail, emailDomain, chooseAccountIndex }
