// The password rules of design 7c and docs/security.md section 3.
// CommonJS so hooks can load it with require(`${__hooks}/lib/password-rules.js`).
// One function for every path that sets a password (sign-up, change, reset), so the
// rules cannot drift apart between them.

// Relative to this file, so the same line works in PocketBase and in Vitest.
const COMMON_PASSWORDS = new Set(require("./common-passwords.js"))

const MIN_LENGTH = 10

// Any letter or digit in any script: "contraseña12" has letters too.
const LETTER = /\p{L}/u
const NUMBER = /\p{N}/u

// Returns null when the password is acceptable, otherwise one short message for the
// user, naming the first rule it breaks.
function checkPassword(password) {
  // Counted in characters, not UTF-16 units, so "ñ" or an emoji counts once.
  if (Array.from(password).length < MIN_LENGTH) {
    return "Use at least 10 characters."
  }
  if (!LETTER.test(password)) {
    return "Include at least one letter."
  }
  if (!NUMBER.test(password)) {
    return "Include at least one number."
  }
  if (COMMON_PASSWORDS.has(password.toLowerCase())) {
    return "That password is too common."
  }
  return null
}

module.exports = { checkPassword }
