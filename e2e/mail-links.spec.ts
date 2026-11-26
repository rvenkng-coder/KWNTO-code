// Protects Plan 6 D9 / Review Focus 1: the pages the verification and reset mails link to finish
// the job inside the app (the dashboard is blocked on the public address).
import { test, expect } from '@playwright/test'
import { uniqueEmail } from './helpers/admin'
import { mintToken } from './helpers/tokens'
import { signUp } from './helpers/ui'

const PASSWORD = 'KwntoPass99'
const NEW_PASSWORD = 'BrandNewPass77'

async function signIn(page: import('@playwright/test').Page, email: string, password: string): Promise<void> {
  await page.getByLabel('Email').fill(email)
  await page.getByLabel('Password').fill(password)
  await page.getByRole('button', { name: 'Sign in' }).click()
}

// C4: a bad verification link says so and offers the way back
test('a bad verification link says so and offers the way back', async ({ page }) => {
  await page.goto('/#/verify/aaa.bbb.ccc')
  await expect(page.getByRole('alert')).toHaveText(
    'This verification link is not valid or has expired. Sign in and ask for a new one.',
  )
  await page.getByRole('link', { name: 'Go to KWNTO' }).click()
  await expect(page.getByRole('heading', { name: 'Sign in' })).toBeVisible()
})

// C5: the verification link verifies the account
test('the verification link verifies the account', async ({ page }) => {
  const email = uniqueEmail()
  await page.goto('/')
  await signUp(page, email, 'Linker', PASSWORD)
  // Minting rewrites the user's tokenKey, which also signs the session token, so mint BEFORE signing in.
  const token = await mintToken(email, 'verification')
  await page.getByRole('button', { name: 'Sign in' }).first().click()
  await signIn(page, email, PASSWORD)
  await expect(page.getByText('Verify your email to create or join a team.')).toBeVisible({ timeout: 10_000 })
  await expect(page.getByRole('button', { name: 'Create team' })).toBeDisabled()

  await page.goto(`/#/verify/${token}`)
  await expect(page.getByRole('status')).toHaveText('Your email is verified. You can now create and join teams.')
  await page.getByRole('link', { name: 'Go to KWNTO' }).click()
  await expect(page.getByRole('button', { name: 'Create team' })).toBeEnabled({ timeout: 10_000 })
  await expect(page.getByText('Verify your email to create or join a team.')).toHaveCount(0)
})

// C6: the reset link sets a new password that follows the rules
test('the reset link sets a new password that follows the rules', async ({ page }) => {
  const email = uniqueEmail()
  await page.goto('/')
  await signUp(page, email, 'Resetter', PASSWORD)
  const token = await mintToken(email, 'passwordReset')

  const posts: string[] = []
  page.on('request', (req) => {
    if (req.url().includes('/confirm-password-reset') && req.method() === 'POST') posts.push(req.url())
  })
  await page.goto(`/#/reset/${token}`)
  await page.getByLabel('New password', { exact: true }).fill(NEW_PASSWORD)
  await page.getByLabel('Repeat new password').fill('SomethingElse55')
  await page.getByRole('button', { name: 'Set password' }).click()
  await expect(page.getByRole('alert')).toHaveText('The two passwords are not the same.')
  expect(posts).toHaveLength(0)

  await page.getByLabel('New password', { exact: true }).fill('short1')
  await page.getByLabel('Repeat new password').fill('short1')
  await page.getByRole('button', { name: 'Set password' }).click()
  await expect(page.getByRole('alert')).toContainText('10')
  expect(posts).toHaveLength(1)

  await page.getByLabel('New password', { exact: true }).fill(NEW_PASSWORD)
  await page.getByLabel('Repeat new password').fill(NEW_PASSWORD)
  await page.getByRole('button', { name: 'Set password' }).click()
  await expect(page.getByRole('status')).toHaveText('Your password was changed. Sign in with the new password.')

  // The new password signs in (the account is still unverified, so only the session is checked); the old one does not.
  await page.getByRole('link', { name: 'Go to KWNTO' }).click()
  await signIn(page, email, PASSWORD)
  await expect(page.getByTestId('form-error')).toBeVisible()
  await signIn(page, email, NEW_PASSWORD)
  await expect(page.getByTestId('session-user')).toContainText('Resetter', { timeout: 10_000 })
})
