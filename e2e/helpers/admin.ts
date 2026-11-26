import crypto from 'node:crypto'
import PocketBase from 'pocketbase'

const PB_URL = process.env.KWNTO_PB_URL ?? 'http://127.0.0.1:8091'
const ADMIN_EMAIL = process.env.KWNTO_ADMIN_EMAIL ?? 'admin@example.test'
const ADMIN_PASSWORD = process.env.KWNTO_ADMIN_PASSWORD ?? 'test-admin-password-1'

let _adminPB: PocketBase | undefined

/** The test backend as its superuser (rules do not apply; hooks still run). */
export async function adminPB(): Promise<PocketBase> {
  if (!_adminPB) {
    _adminPB = new PocketBase(PB_URL)
    await _adminPB.collection('_superusers').authWithPassword(ADMIN_EMAIL, ADMIN_PASSWORD)
  }
  return _adminPB
}

export async function verifyByEmail(email: string): Promise<void> {
  const pb = await adminPB()
  const user = await pb.collection('users').getFirstListItem(`email = '${email}'`)
  await pb.collection('users').update(user.id, { verified: true })
}

export function uniqueEmail(): string {
  return `e2e-${crypto.randomUUID()}@test.com`
}

/** True when an account with this email exists (read as the admin). */
export async function userExists(email: string): Promise<boolean> {
  const pb = await adminPB()
  const found = await pb
    .collection('users')
    .getList(1, 1, { filter: pb.filter('email = {:email}', { email: email.toLowerCase() }) })
  return found.totalItems > 0
}

/** One record as the admin stored it (rules do not apply). */
export async function adminRecord(collection: string, id: string): Promise<Record<string, unknown>> {
  return (await adminPB()).collection(collection).getOne(id)
}
