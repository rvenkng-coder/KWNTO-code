// Team join codes (design section 5).
// CommonJS so hooks can load it with require(`${__hooks}/lib/join-code.js`).

// 32 characters without look-alikes (no 0/O, no 1/I), so a code shown on a projector
// is typed right. 32^8 is about 10^12 codes; guessing is also rate limited (team-attempts.js).
const JOIN_CODE_ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789"
const JOIN_CODE_LENGTH = 8

// randomIndex(n) returns an integer in [0, n). It is passed in so tests can control it;
// the hook passes a crypto-quality source, never Math.random.
function generateJoinCode(randomIndex) {
  let code = ""
  for (let i = 0; i < JOIN_CODE_LENGTH; i++) {
    code += JOIN_CODE_ALPHABET[randomIndex(JOIN_CODE_ALPHABET.length)]
  }
  return code
}

module.exports = { generateJoinCode, JOIN_CODE_ALPHABET }
