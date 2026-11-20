import crypto from 'node:crypto'
import type PocketBase from 'pocketbase'
import { afterEach, beforeEach, expect, test } from 'vitest'
import { type FakeSmtp, SMTP_HOST_FOR_BACKEND, startFakeSmtp } from './helpers/fake-smtp.ts'
import { asAdmin, signUp } from './helpers/pb.ts'

// A new account gets its verification mail at once, from the server (users-verify-mail
// hook), not only when the person presses "Resend verification email". PocketBase 0.40.6
// sends nothing on create by itself (checked by counting connections to a fake SMTP server).
// The tests point PocketBase's SMTP setting at a fake server and count the mails it gets.
// Rule files run one at a time (vitest.config.ts), so changing the SMTP setting here
// cannot disturb another file.

const GOOD_PASSWORD = 'Signup-password-2468'
let smtp: FakeSmtp
let admin: PocketBase
let savedSmtp: unknown

async function useSmtp(host: string, port: number): Promise<void> {
  await admin.settings.update({ smtp: { enabled: true, host, port, tls: false } })
}

function mailsTo(email: string): string[] {
  return smtp.messages.filter((m) => m.includes(`To: ${email}`))
}

function newEmail(): string {
  return `verify-mail-${crypto.randomUUID()}@example.test`
}

beforeEach(async () => {
  admin = await asAdmin()
  savedSmtp = (await admin.settings.getAll()).smtp
  smtp = await startFakeSmtp()
  await useSmtp(SMTP_HOST_FOR_BACKEND, smtp.port)
})

afterEach(async () => {
  await admin.settings.update({ smtp: savedSmtp })
  await smtp.close()
})

// Protects the sign-up screen's promise ("Check your email to verify your account"): one
// verification mail reaches the new address, with the app link, and no second one follows.
test('sign-up sends exactly one verification mail to the new address', async () => {
  const email = newEmail()
  await signUp(email, GOOD_PASSWORD)
  await expect.poll(() => mailsTo(email).length, { message: 'no mail arrived', timeout: 8000 }).toBe(1)
  await new Promise((resolve) => setTimeout(resolve, 1500))
  expect(mailsTo(email)).toHaveLength(1)
  expect(mailsTo(email)[0]).toContain('Subject: Verify your KWNTO email')
}, 15000)

// Protects the admin path: an account the admin adds already verified gets no mail.
test('an account created already verified gets no mail', async () => {
  const email = newEmail()
  await admin.collection('users').create({
    email,
    password: GOOD_PASSWORD,
    passwordConfirm: GOOD_PASSWORD,
    verified: true,
  })
  await new Promise((resolve) => setTimeout(resolve, 1500))
  expect(mailsTo(email)).toHaveLength(0)
})

// Protects the failure mode: mail is set up but cannot be sent (nothing listens on the
// port). The account is saved, so the sign-up must still succeed and the account exist;
// the person can press "Resend verification email" later. The hook logs the reason to
// the server console.
test('a mail that cannot be sent does not fail the sign-up', async () => {
  await useSmtp('127.0.0.1', 1)
  const email = newEmail()
  const { id } = await signUp(email, GOOD_PASSWORD)
  const stored = await admin.collection('users').getOne(id)
  expect(stored.verified).toBe(false)
})
