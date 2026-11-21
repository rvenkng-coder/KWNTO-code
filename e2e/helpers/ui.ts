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
  await page.getByRole('button', { name: 'Sign up' }).click()
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
  await page
    .getByRole('paragraph')
    .filter({ hasText: 'Already have an account?' })
    .getByRole('button', { name: 'Sign in' })
    .click()
  await page.getByLabel('Email').fill(email)
  await page.getByLabel('Password').fill(password)
  await page.getByRole('button', { name: 'Sign in' }).click()
  await expect(page.getByTestId('session-user')).toContainText(name, {
    timeout: 10_000,
  })
}

/**
 * Creates a team through the in-page dialog and waits for it to appear in team-list.
 */
export async function createTeam(page: Page, name: string): Promise<void> {
  await page.getByRole('button', { name: 'Create team' }).click()
  await page.getByRole('dialog').getByLabel('Team name').fill(name)
  await page.getByRole('dialog').getByRole('button', { name: 'Create' }).click()
  await expect(page.getByTestId('team-list')).toContainText(name, {
    timeout: 10_000,
  })
}

/** Opens a team from the Teams screen by its name. */
export async function openTeam(page: Page, name: string): Promise<void> {
  await page.getByTestId('team-list').getByRole('button', { name, exact: true }).click()
  // Everything the screen loads (members, owner flag, settings) has arrived, so a
  // check that something is absent cannot pass just because it has not loaded yet.
  await expect(page.getByTestId('member-list')).toHaveAttribute('data-loaded', 'true')
}

/**
 * Owner on the team detail screen: turns the join code on if it is off (a new
 * team starts with it off, decision D1) and returns the code.
 */
export async function enableJoinCode(page: Page): Promise<string> {
  // The code and its button appear together once the settings have loaded.
  await expect(page.getByTestId('join-code')).toBeVisible()
  const enable = page.getByRole('button', { name: 'Enable' })
  if (await enable.isVisible()) {
    await enable.click()
  }
  await expect(page.getByRole('button', { name: 'Disable' })).toBeVisible()
  const code = (await page.getByTestId('join-code').textContent()) ?? ''
  expect(code).not.toBe('')
  return code
}

/** Types a join code on the Teams screen and waits for the team to appear. */
export async function joinWithCode(page: Page, code: string, teamName: string): Promise<void> {
  await page.getByRole('button', { name: 'Join with code' }).click()
  await page.getByPlaceholder('Join code').fill(code)
  await page.getByRole('button', { name: 'Join', exact: true }).click()
  await expect(page.getByTestId('team-list')).toContainText(teamName)
}

/**
 * Waits until the page has stopped talking to the server, so "the team is not in the
 * list" is checked after the list has been fetched, not before.
 */
export async function settled(page: Page): Promise<void> {
  await page.waitForLoadState('networkidle')
}
