// Protects: deleting a team removes it from the list immediately without a manual reload.
import { test, expect } from '@playwright/test'
import { uniqueEmail } from './helpers/admin'
import { signUpVerifyAndSignIn, createTeam, openTeam, enableJoinCode, settled } from './helpers/ui'

// C1: a deleted team leaves the list at once
test('a deleted team is gone from the list at once', async ({ page }) => {
  await page.goto('/')
  await signUpVerifyAndSignIn(page, uniqueEmail(), 'Owner')
  await createTeam(page, 'Crew 7')

  // Open the team detail and delete it
  await openTeam(page, 'Crew 7')
  await page.getByRole('button', { name: 'Delete team' }).click()
  await page.getByRole('dialog').getByRole('button', { name: 'Delete team' }).click()

  // The handler navigates to #/ after delete; wait for the teams screen to be shown
  await settled(page)
  await expect(page.getByTestId('team-list')).toBeVisible()
  await expect(page.getByTestId('team-list').getByRole('button', { name: 'Crew 7' })).toHaveCount(0)
})

// C2: detail heading names the team
test('the team detail heading is the team name', async ({ page }) => {
  await page.goto('/')
  await signUpVerifyAndSignIn(page, uniqueEmail(), 'Owner')
  await createTeam(page, 'Crew 7')
  await openTeam(page, 'Crew 7')

  // The heading should show the team name
  await expect(page.getByRole('heading', { name: 'Crew 7' })).toBeVisible()
})

// C3: join notice clears on the next action
test('the join notice clears on the next action', async ({ page, browser }) => {
  const ownerEmail = uniqueEmail()
  await page.goto('/')
  await signUpVerifyAndSignIn(page, ownerEmail, 'Owner')
  await createTeam(page, 'Crew 7')

  // Enable join code so another user can join
  await openTeam(page, 'Crew 7')
  const joinCode = await enableJoinCode(page)

  // Another user joins with the code
  const page2 = await browser.newPage()
  await page2.goto('/')
  await signUpVerifyAndSignIn(page2, uniqueEmail(), 'Member')
  await page2.getByPlaceholder('Join code').fill(joinCode)
  await page2.getByRole('button', { name: 'Join' }).click()

  // The join notice should be visible
  await expect(page2.getByText(/^Joined Crew 7\.$/)).toBeVisible({ timeout: 10_000 })

  // Now create a new team on the same page — the notice should clear
  await page2.getByRole('button', { name: 'Create team' }).click()
  await page2.getByRole('dialog').getByLabel('Team name').fill('New Team')
  await page2.getByRole('dialog').getByRole('button', { name: 'Create' }).click()
  await expect(page2.getByTestId('team-list')).toContainText('New Team', {
    timeout: 10_000,
  })

  // The join notice should be gone
  await expect(page2.getByText(/^Joined Crew 7\.$/)).toHaveCount(0)
  await page2.close()
})

// C4: sign-up shows a confirmation, not a filled form
test('sign-up replaces the form with a confirmation', async ({ page }) => {
  const email = uniqueEmail()
  await page.goto('/')
  await page.getByRole('button', { name: 'Sign up' }).click()
  await page.getByLabel('Email').fill(email)
  await page.getByLabel('Name').fill('Owner')
  await page.getByLabel('Password').fill('KwntoPass99')
  await page.getByRole('button', { name: 'Sign up' }).click()

  // After sign-up, the confirmation text should be visible
  await expect(page.getByText('Check your email to verify your account, then sign in.')).toBeVisible({ timeout: 10_000 })

  // The password field should NOT be on screen
  await expect(page.getByLabel('Password')).toHaveCount(0)

  // A Sign in button should be present
  await expect(page.getByRole('button', { name: 'Sign in' }).first()).toBeVisible()
})

// C9: keyboard reaches the account controls
test('forgot password works from the keyboard', async ({ page }) => {
  await page.goto('/')
  // Tab to Forgot password? (email → password → forgot password)
  await page.keyboard.press('Tab')
  await page.keyboard.press('Tab')
  await page.keyboard.press('Tab')
  await page.keyboard.press('Enter')
  // The neutral message should appear
  await expect(page.getByText('If that account exists, we sent a link.')).toBeVisible({ timeout: 10_000 })
})

// Lost error messages: toggle fails and the alert appears
test('toggle join code shows an error when the server fails', async ({ page }) => {
  await page.goto('/')
  await signUpVerifyAndSignIn(page, uniqueEmail(), 'Owner')
  await createTeam(page, 'Crew 7')

  // Open the team detail and enable join code first so the toggle button exists
  await openTeam(page, 'Crew 7')
  await enableJoinCode(page)

  // Route the next setJoinCodeEnabled request to fail with a custom error message
  await page.route('**/api/collections/team_settings/**', async (route) => {
    const method = route.request().method()
    if (method === 'PATCH') {
      await route.fulfill({
        status: 500,
        body: JSON.stringify({ message: 'Failed to toggle join code' }),
      })
    } else {
      await route.continue()
    }
  })

  // Click the Disable button to trigger the toggle
  await page.getByRole('button', { name: 'Disable' }).click()

  // The error alert should appear
  await expect(page.getByTestId('form-error')).toContainText('Failed to toggle join code')
})


