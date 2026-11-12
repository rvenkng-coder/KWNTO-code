// The email typed into an invite (design section 5), as the invite route uses it.
// CommonJS so hooks can load it with require(`${__hooks}/lib/invite-email.js`).
// Pure, so Vitest tests it (tests/hooks/invite-email.unit.test.ts).

// Emails are typed by hand, so stray spaces and capitals must not hide an account.
// Anything that is not a string (a missing body, a number) matches no account.
function normalisedEmail(value) {
  return typeof value === "string" ? value.trim().toLowerCase() : ""
}

// What the security log keeps of the address: only the domain. The full address is
// never stored, so the log cannot become a list of the emails that have accounts.
function emailDomain(email) {
  const at = email.lastIndexOf("@")
  return at === -1 ? "" : email.slice(at + 1)
}

module.exports = { normalisedEmail, emailDomain }
