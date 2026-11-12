import crypto from 'node:crypto'
import PocketBase from 'pocketbase'

export const PB_URL: string = process.env.KWNTO_PB_URL ?? 'http://127.0.0.1:8091'

export type TestUser = { id: string; email: string; password: string }

export function asAnonymous(): PocketBase {
  return new PocketBase(PB_URL)
}

export async function asAdmin(): Promise<PocketBase> {
  const pb = new PocketBase(PB_URL)
  const email = process.env.KWNTO_ADMIN_EMAIL ?? 'admin@example.test'
  const password = process.env.KWNTO_ADMIN_PASSWORD ?? 'test-admin-password-1'
  await pb.collection('_superusers').authWithPassword(email, password)
  return pb
}

export async function createUser(options?: { verified?: boolean }): Promise<TestUser> {
  const admin = await asAdmin()
  const uuid = crypto.randomUUID()
  const email = `user-${uuid}@example.test`
  const password = 'Test-password-1234'
  const verified = options?.verified ?? true

  const record = await admin.collection('users').create({
    email,
    password,
    passwordConfirm: password,
    verified,
  })

  return { id: record.id, email, password }
}

// Sign-up goes through the same door a visitor uses: the public users create, not the
// admin API, so the sign-up hooks and rules apply. The result is NOT verified.
// `extra` adds fields to the request body (for example a forged `verified: true`).
export async function signUp(email: string, password: string, extra?: Record<string, unknown>): Promise<{ id: string }> {
  const record = await asAnonymous().collection('users').create({
    email,
    password,
    passwordConfirm: password,
    ...extra,
  })
  return { id: record.id }
}

export async function asUser(user: TestUser): Promise<PocketBase> {
  const pb = new PocketBase(PB_URL)
  await pb.collection('users').authWithPassword(user.email, user.password)
  return pb
}
