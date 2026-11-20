import crypto from 'node:crypto'
import { adminPB } from './admin'

// A real verification or reset token, signed the way PocketBase 0.40.6 signs it: HS256 over
// `<header>.<claims>` with the key `record.tokenKey + collection.<type>Token.secret`, claims
// id, type, collectionId, email and exp. Neither key is readable through the API (tokenKey is a
// hidden field and the collection's secret is never returned), but a superuser may SET both, so
// the helper sets them to values it knows and signs with those. Setting them only invalidates
// tokens issued earlier for that user and for that mail type; no new dependency (node:crypto).
export type TokenType = 'verification' | 'passwordReset'

const SECRET_FIELD = { verification: 'verificationToken', passwordReset: 'passwordResetToken' } as const
const SECRET = 'e2e-secret-'.padEnd(50, 'x')

const b64 = (value: string | Buffer): string => Buffer.from(value).toString('base64url')

export async function mintToken(email: string, type: TokenType): Promise<string> {
  const pb = await adminPB()
  const user = await pb.collection('users').getFirstListItem(pb.filter('email = {:email}', { email: email.toLowerCase() }))
  const tokenKey = crypto.randomBytes(25).toString('hex')
  await pb.collection('users').update(user.id, { tokenKey })
  const collection = await pb.collections.getOne('users')
  const field = SECRET_FIELD[type]
  await pb.collections.update('users', { [field]: { ...collection[field], secret: SECRET } })
  const header = b64(JSON.stringify({ alg: 'HS256', typ: 'JWT' }))
  const claims = b64(JSON.stringify({ id: user.id, type, collectionId: collection.id, email: user.email, exp: Math.floor(Date.now() / 1000) + 3600 }))
  const signature = crypto.createHmac('sha256', tokenKey + SECRET).update(`${header}.${claims}`).digest('base64url')
  return `${header}.${claims}.${signature}`
}
