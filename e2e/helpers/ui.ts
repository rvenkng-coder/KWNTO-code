import { Page, expect } from '@playwright/test'
import { verifyByEmail } from './admin'

/**
 * Fills the sign-up form, submits, and waits for the result.
 * Waits for either "Check your email" confirmation or a form-error.
 */
export async function signUp(
  page: Page,
  email: string,
  name: string,
  password: string,
): Promise<void> {
  await page.getByRole('link', { name: 'Sign up' }).click()
  await page.getByLabel('Email').fill(email)
  await page.getByLabel('Name').fill(name)
  await page.getByLabel('Password').fill(password)
  await page.getByRole('button', { name: 'Sign up' }).click()
  // Wait for sign-up to finish: either confirmation or error
  await expect(
    page.getByText('Check your email').or(page.getByTestId('form-error')),
  ).toBeVisible({ timeout: 10_000 })
}

/**
 * Signs up, verifies by email, then signs in and waits for the session to show.
 */
export async function signUpVerifyAndSignIn(
  page: Page,
  email: string,
  name: string,
  password = 'KwntoPass99',
): Promise<void> {
  await signUp(page, email, name, password)
  await verifyByEmail(email)
  await page.getByRole('link', { name: 'Sign in' }).click()
  await page.getByLabel('Email').fill(email)
  await page.getByLabel('Password').fill(password)
  await page.getByRole('button', { name: 'Sign in' }).click()
  await expect(page.getByTestId('session-user')).toContainText(name, {
    timeout: 10_000,
  })
}

/**
 * Creates a team via the UI prompt() and waits for it to appear in team-list.
 */
export async function createTeam(page: Page, name: string): Promise<void> {
  page.once('dialog', (dialog) => dialog.accept(name))
  await page.getByRole('button', { name: 'Create team' }).click()
  await expect(page.getByTestId('team-list')).toContainText(name, {
    timeout: 10_000,
  })
}
