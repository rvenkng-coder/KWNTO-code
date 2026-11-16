// Client-made ids (plan decision: the browser makes every new content record's id, so undo
// can re-create a record with its id). PocketBase ids are 15 characters of a-z0-9.

const ALPHABET = '0123456789abcdefghijklmnopqrstuvwxyz'
const ID_LENGTH = 15

type RandomBytes = (bytes: Uint8Array) => Uint8Array

const browserRandom: RandomBytes = (bytes) => crypto.getRandomValues(bytes)

export function newId(random: RandomBytes = browserRandom): string {
  const bytes = random(new Uint8Array(ID_LENGTH))
  let id = ''
  // The modulo bias (256 is not a multiple of 36) is irrelevant for ids.
  for (const byte of bytes) id += ALPHABET[byte % ALPHABET.length]
  return id
}
