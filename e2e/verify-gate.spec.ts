// Protects: an unverified user can request a resend of the verification email.
import { test, expect } from '@playwright/test'
import { uniqueEmail } from './helpers/admin'
import { signUp } from './helpers/ui'

// C5: an unverified user can resend the verification email
test('an unverified user can resend the verification email', async ({ page }) => {
  const email = uniqueEmail()
  await page.goto('/')
  await signUp(page, email, 'Unverified', 'KwntoPass99')
  // Sign in as the unverified user so we reach the Teams screen
  await page.getByRole('link', { name: 'Sign in' }).click()
  await page.getByLabel('Email').fill(email)
  await page.getByLabel('Password').fill('KwntoPass99')
  await page.getByRole('button', { name: 'Sign in' }).click()
  // Wait for the Teams screen to load (gate text appears)
  await expect(page.getByText('Verify your email')).toBeVisible({ timeout: 10_000 })

  // Intercept the verification request so we can assert on it
  const verificationPromise = page.waitForResponse(
    (response) => response.url().includes('/users/request-verification') && response.request().method() === 'POST',
  )

  // Click the resend button
  await page.getByRole('button', { name: 'Resend verification email' }).click()

  // The request should have been sent with the user's email
  const verificationResponse = await verificationPromise
  expect(verificationResponse.ok()).toBe(true)

  // Confirmation message should appear
  await expect(page.getByText('Sent. Check your inbox.')).toBeVisible({ timeout: 10_000 })
})

// Protects: join and accept are disabled for unverified users; the gate text is shown once.
import { signUpVerifyAndSignIn, createTeam, openTeam, settled } from './helpers/ui'

// C6: join and accept are disabled until verified
test('join and accept are disabled until verified', async ({ page, browser }) => {
  // Owner creates a team and invites the unverified user
  const ownerEmail = uniqueEmail()
  await page.goto('/')
  await signUpVerifyAndSignIn(page, ownerEmail, 'Owner')
  await createTeam(page, 'Crew')
  await openTeam(page, 'Crew')

  // Create an unverified invitee (sign up but DO NOT verify)
  const inviteeEmail = uniqueEmail()
  const page2 = await browser.newPage()
  await page2.goto('/')
  await signUp(page2, inviteeEmail, 'Invitee', 'KwntoPass99')
  // Sign in as the unverified user
  await page2.getByRole('link', { name: 'Sign in' }).click()
  await page2.getByLabel('Email').fill(inviteeEmail)
  await page2.getByLabel('Password').fill('KwntoPass99')
  await page2.getByRole('button', { name: 'Sign in' }).click()

  // Wait for the Teams screen to load
  await expect(page2.getByText('Verify your email')).toBeVisible({ timeout: 10_000 })

  // Now send an invite from the owner's side
  await page.getByPlaceholder('Email').fill(inviteeEmail)
  await page.getByRole('button', { name: 'Send invite' }).click()
  await expect(page.getByText('Invite sent!')).toBeVisible()

  // Reload the invitee's page to see the invite
  await page2.reload()
  await settled(page2)

  // Create team button should be disabled
  await expect(page2.getByRole('button', { name: 'Create team' })).toBeDisabled()

  // Join button should be disabled
  await expect(page2.getByRole('button', { name: 'Join' })).toBeDisabled()

  // Accept button in the invite inbox should be disabled
  await expect(page2.getByTestId('invite-inbox')).toBeVisible()
  await expect(page2.getByRole('button', { name: 'Accept' })).toBeDisabled()

  // Decline button should still be enabled
  await expect(page2.getByRole('button', { name: 'Decline' })).toBeEnabled()

  // Gate text should appear exactly once
  const gateTexts = await page2.getByText('Verify your email to create or join a team.').all()
  expect(gateTexts.length).toBe(1)

  await page2.close()
})
