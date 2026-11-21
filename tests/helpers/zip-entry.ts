import { inflateRawSync } from 'node:zlib'

const EOCD = 0x06054b50
const CENTRAL = 0x02014b50

/** Reads one file out of a zip (a .docx is one) as text. Uses only node:zlib. */
export function zipEntryText(bytes: Uint8Array, name: string): string {
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength)
  let eocd = bytes.length - 22
  while (eocd >= 0 && view.getUint32(eocd, true) !== EOCD) eocd--
  if (eocd < 0) throw new Error(`No zip entry ${name}`)
  const count = view.getUint16(eocd + 10, true)
  let at = view.getUint32(eocd + 16, true)
  for (let i = 0; i < count && view.getUint32(at, true) === CENTRAL; i++) {
    const method = view.getUint16(at + 10, true)
    const size = view.getUint32(at + 20, true)
    const nameLen = view.getUint16(at + 28, true)
    const extraLen = view.getUint16(at + 30, true)
    const commentLen = view.getUint16(at + 32, true)
    const local = view.getUint32(at + 42, true)
    const entryName = new TextDecoder().decode(bytes.subarray(at + 46, at + 46 + nameLen))
    if (entryName === name) {
      const start = local + 30 + view.getUint16(local + 26, true) + view.getUint16(local + 28, true)
      const data = bytes.subarray(start, start + size)
      return new TextDecoder().decode(method === 0 ? data : inflateRawSync(data))
    }
    at += 46 + nameLen + extraLen + commentLen
  }
  throw new Error(`No zip entry ${name}`)
}
