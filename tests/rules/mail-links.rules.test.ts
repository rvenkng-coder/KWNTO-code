import { expect, test } from 'vitest'
import { adminSend } from './helpers/pb.ts'

// Plan 6 D9 / Review Focus 1: PocketBase's default verification and reset mails link to the
// dashboard (`/_/#/auth/...`), which the proxy blocks on the public address. The users
// collection's templates must link into the app. Not a rule on a collection, so no coverage entry.

type Template = { subject: string; body: string }
type Users = { verificationTemplate: Template; resetPasswordTemplate: Template }

// Protects: a verification or reset mail never sends a student to the blocked dashboard.
test('verification and reset mails link into the app, never the dashboard', async () => {
  const res = await adminSend('/api/collections/users')
  expect(res.status).toBe(200)
  const users = (await res.json()) as Users
  expect(users.verificationTemplate.body).toContain('{APP_URL}/#/verify/{TOKEN}')
  expect(users.resetPasswordTemplate.body).toContain('{APP_URL}/#/reset/{TOKEN}')
  expect(users.verificationTemplate.body).not.toContain('/_/')
  expect(users.resetPasswordTemplate.body).not.toContain('/_/')
  expect(users.verificationTemplate.subject).toBe('Verify your KWNTO email')
  expect(users.resetPasswordTemplate.subject).toBe('Reset your KWNTO password')
})
