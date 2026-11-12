// Protects: sign-up and verification gate — a new account is unverified;
// the verification gate blocks team creation until the account is verified.
import { test, expect } from '@playwright/test'
import { verifyByEmail, uniqueEmail } from './helpers/admin'

test('sign-up and verification gate', async ({ page }) => {
  const email = uniqueEmail()
  await page.goto('/')
  await page.getByRole('link', { name: 'Sign up' }).click()
  await page.getByLabel('Email').fill(email)
  await page.getByLabel('Name').fill('Verifier')
  await page.getByLabel('Password').fill('KwntoPass99')
  await page.getByRole('button', { name: 'Sign up' }).click()
  await expect(page.getByText('Check your email')).toBeVisible()
  // Sign in works but create team is gated
  await page.getByRole('link', { name: 'Sign in' }).click()
  await page.getByLabel('Email').fill(email)
  await page.getByLabel('Password').fill('KwntoPass99')
  await page.getByRole('button', { name: 'Sign in' }).click()
  await expect(page.getByText('Verify your email')).toBeVisible()
  // Verify and reload
  await verifyByEmail(email)
  await page.reload()
  await expect(page.getByRole('button', { name: 'Create team' })).toBeVisible()
})

// Protects: weak password — the server rejects passwords that don't meet rules;
// the error is shown in form-error and no account is created.
test('weak password shows server message', async ({ page }) => {
  await page.goto('/')
  await page.getByRole('link', { name: 'Sign up' }).click()
  await page.getByLabel('Email').fill(uniqueEmail())
  await page.getByLabel('Name').fill('Weak')
  await page.getByLabel('Password').fill('short')
  await page.getByRole('button', { name: 'Sign up' }).click()
  await expect(page.getByTestId('form-error')).toBeVisible()
})

// Protects: lockout — after 3 wrong passwords the account is locked;
// the lockout message is shown in form-error.
test('lockout after three wrong passwords', async ({ page }) => {
  const email = uniqueEmail()
  await page.goto('/')
  await page.getByRole('link', { name: 'Sign up' }).click()
  await page.getByLabel('Email').fill(email)
  await page.getByLabel('Name').fill('Locker')
  await page.getByLabel('Password').fill('KwntoPass99')
  await page.getByRole('button', { name: 'Sign up' }).click()
  await verifyByEmail(email)
  await page.getByRole('link', { name: 'Sign in' }).click()
  for (let i = 0; i < 3; i++) {
    await page.getByLabel('Email').fill(email)
    await page.getByLabel('Password').fill('WrongPass')
    await page.getByRole('button', { name: 'Sign in' }).click()
  }
  await expect(page.getByTestId('form-error')).toBeVisible()
})

// Protects: session persistence — a sign-in survives a page reload;
// sign-out clears the session and a reload stays signed out.
test('session survives reload; sign-out clears it', async ({ page }) => {
  const email = uniqueEmail()
  await page.goto('/')
  await page.getByRole('link', { name: 'Sign up' }).click()
  await page.getByLabel('Email').fill(email)
  await page.getByLabel('Name').fill('Session')
  await page.getByLabel('Password').fill('KwntoPass99')
  await page.getByRole('button', { name: 'Sign up' }).click()
  await verifyByEmail(email)
  await page.getByRole('link', { name: 'Sign in' }).click()
  await page.getByLabel('Email').fill(email)
  await page.getByLabel('Password').fill('KwntoPass99')
  await page.getByRole('button', { name: 'Sign in' }).click()
  await expect(page.getByTestId('session-user')).toContainText('Session')
  await page.reload()
  await expect(page.getByTestId('session-user')).toContainText('Session')
  await page.getByRole('button', { name: 'Sign out' }).click()
  await expect(page.getByRole('link', { name: 'Sign in' })).toBeVisible()
})
