// Picks a new join code no team has yet (design section 5, decision D1). Used when a team
// is created (teams.pb.js) and when the owner regenerates the code (teams-join.pb.js),
// so both draw codes the same way. Moved here from teams.pb.js in Task 7: hook handlers
// run in isolated scopes, so a second route could not reach the first handler's helpers.
// CommonJS so hooks can load it with require(`${__hooks}/lib/unused-join-code.js`).
// Needs the PocketBase globals ($security), so it is checked by the rule tests, not Vitest.

// app: the app (or transaction app) to check existing codes with.
function unusedJoinCode(app) {
  const { generateJoinCode, JOIN_CODE_ALPHABET } = require(`${__hooks}/lib/join-code.js`)

  // Crypto-quality randomness: $security draws each character with crypto/rand, and one
  // character from n distinct symbols is a uniform index in [0, n).
  const randomIndex = (n) => {
    if (n > JOIN_CODE_ALPHABET.length) {
      throw new Error(`randomIndex supports at most ${JOIN_CODE_ALPHABET.length} values`)
    }
    const symbols = JOIN_CODE_ALPHABET.slice(0, n)
    return symbols.indexOf($security.randomStringWithAlphabet(1, symbols))
  }

  // A clash is very unlikely (32^8 codes), but the code must be unique because joining
  // looks the team up by it (a unique index enforces it); give up after 5 tries rather
  // than loop.
  for (let attempt = 0; attempt < 5; attempt++) {
    const code = generateJoinCode(randomIndex)
    const clashes = app.findRecordsByFilter("team_settings", "join_code = {:code}", "", 1, 0, { code })
    if (clashes.length === 0) {
      return code
    }
  }
  throw new Error("could not find an unused join code in 5 attempts")
}

module.exports = { unusedJoinCode }
