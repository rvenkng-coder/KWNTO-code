// Protects: sign-up confirmation only on success — a failed sign-up (e.g.
// weak password) shows form-error and does not show the confirmation.
import { test, expect } from '@playwright/test'
import { uniqueEmail, userExists } from './helpers/admin'
import { signUpVerifyAndSignIn, createTeam, openTeam, enableJoinCode, joinWithCode, settled } from './helpers/ui'

// Protects: a refused sign-up never says that an email was sent, and makes no account.
test('sign-up with weak password shows error, no confirmation', async ({ page }) => {
  const email = uniqueEmail()
  await page.goto('/')
  await page.getByRole('button', { name: 'Sign up' }).click()
  await page.getByLabel('Email').fill(email)
  await page.getByLabel('Name').fill('Shorty')
  await page.getByLabel('Password').fill('short1')
  await page.getByRole('button', { name: 'Sign up' }).click()
  await expect(page.getByTestId('form-error')).toBeVisible()
  await expect(page.getByText('Check your email')).toHaveCount(0)
  expect(await userExists(email)).toBe(false)
})

// Protects: member view — a member opens the team and sees both names and no
// error. (Controls hidden from members are checked in accounts.spec.ts.)
test('member view shows both names and no error', async ({ page, browser }) => {
  await page.goto('/')
  await signUpVerifyAndSignIn(page, uniqueEmail(), 'Owner')
  await createTeam(page, 'Crew')
  await openTeam(page, 'Crew')
  const joinCode = await enableJoinCode(page)
  const page2 = await browser.newPage()
  await page2.goto('/')
  await signUpVerifyAndSignIn(page2, uniqueEmail(), 'Member')
  await joinWithCode(page2, joinCode, 'Crew')
  await openTeam(page2, 'Crew')
  await expect(page2.getByTestId('member-list')).toContainText('Owner')
  await expect(page2.getByTestId('member-list')).toContainText('Member')
  await expect(page2.getByTestId('form-error')).toHaveCount(0)
  await expect(page2.getByTestId('join-code')).toHaveCount(0)
  await page2.close()
})

// Protects: join code toggle — owner can disable/enable the code; a wrong
// code on the Teams screen shows form-error and no team in team-list.
test('join code toggle and wrong code rejection', async ({ page, browser }) => {
  const ownerEmail = uniqueEmail()
  const otherEmail = uniqueEmail()
  // Owner creates team (join code disabled by default)
  await page.goto('/')
  await signUpVerifyAndSignIn(page, ownerEmail, 'Owner')
  await createTeam(page, 'Crew')
  // Owner enables join code, then disables it
  await openTeam(page, 'Crew')
  await page.getByRole('button', { name: 'Enable' }).click()
  await expect(page.getByRole('button', { name: 'Disable' })).toBeVisible()
  await page.getByRole('button', { name: 'Disable' }).click()
  await expect(page.getByRole('button', { name: 'Enable' })).toBeVisible()
  // Other user tries to join with the now-invalid code
  const page2 = await browser.newPage()
  await page2.goto('/')
  await signUpVerifyAndSignIn(page2, otherEmail, 'Other')
  const oldCode = await page.getByTestId('join-code').textContent()
  await page2.getByRole('button', { name: 'Join with code' }).click()
  await page2.getByPlaceholder('Join code').fill(oldCode ?? '')
  await page2.getByRole('button', { name: 'Join', exact: true }).click()
  await expect(page2.getByTestId('form-error')).toHaveText('That join code is not valid.')
  await expect(page2.getByText('Joined successfully!')).toHaveCount(0)
  await settled(page2)
  await expect(page2.getByTestId('team-list')).not.toContainText('Crew')
  await page2.close()
})
