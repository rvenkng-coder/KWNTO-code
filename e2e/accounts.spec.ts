// Protects: sign-up and verification gate — a new account is unverified;
// the verification gate blocks team creation until the account is verified.
import { test, expect, type Page } from '@playwright/test'
import { verifyByEmail, uniqueEmail } from './helpers/admin'
import { signUp, signUpVerifyAndSignIn, createTeam, openTeam, enableJoinCode, joinWithCode, settled } from './helpers/ui'

// Protects: XSS as text (security.md section 5) — team names are rendered as text, not HTML.
test('XSS as text', async ({ page }) => {
  const email = uniqueEmail()
  await page.goto('/')
  await signUpVerifyAndSignIn(page, email, 'Xss')
  const xssName = '<script>window.__xss=1</script>'
  await createTeam(page, xssName)
  await expect(page.getByText(xssName)).toBeVisible()
  await expect(page.evaluate(() => window.__xss)).resolves.toBeUndefined()
})

// Protects: join by code — owner turns the code on, member joins, names shown not emails.
test('join by code', async ({ page, browser }) => {
  await page.goto('/')
  await signUpVerifyAndSignIn(page, uniqueEmail(), 'Owner')
  await createTeam(page, 'Crew')
  await openTeam(page, 'Crew')
  const joinCode = await enableJoinCode(page)
  const page2 = await browser.newPage()
  await page2.goto('/')
  await signUpVerifyAndSignIn(page2, uniqueEmail(), 'Member')
  await joinWithCode(page2, joinCode, 'Crew')
  // Owner reopens the team and sees the member by name, not email
  await page.getByRole('button', { name: 'Teams', exact: true }).click()
  await openTeam(page, 'Crew')
  await expect(page.getByTestId('member-list')).toContainText('Member')
  await expect(page.getByTestId('member-list')).not.toContainText('@')
  await page2.close()
})

// Protects: wrong code and regenerate — wrong code fails, regenerate invalidates old code.
test('wrong code and regenerate', async ({ page, browser }) => {
  await page.goto('/')
  await signUpVerifyAndSignIn(page, uniqueEmail(), 'Owner')
  await createTeam(page, 'Crew')
  await page.getByRole('button', { name: 'Join with code' }).click()
  await page.getByPlaceholder('Join code').fill('WRONGCODE')
  await page.getByRole('button', { name: 'Join', exact: true }).click()
  await expect(page.getByTestId('form-error')).toHaveText('That join code is not valid.')
  await expect(page.getByText('Joined successfully!')).toHaveCount(0)
  // Regenerate: the new code differs and the old one stops working
  await openTeam(page, 'Crew')
  const oldCode = await enableJoinCode(page)
  await page.getByRole('button', { name: 'Regenerate' }).click()
  await expect(page.getByTestId('join-code')).not.toHaveText(oldCode)
  const page2 = await browser.newPage()
  await page2.goto('/')
  await signUpVerifyAndSignIn(page2, uniqueEmail(), 'Other')
  await page2.getByRole('button', { name: 'Join with code' }).click()
  await page2.getByPlaceholder('Join code').fill(oldCode)
  await page2.getByRole('button', { name: 'Join', exact: true }).click()
  await expect(page2.getByTestId('form-error')).toHaveText('That join code is not valid.')
  await expect(page2.getByText('Joined successfully!')).toHaveCount(0)
  await settled(page2)
  await expect(page2.getByTestId('team-list')).not.toContainText('Crew')
  await page2.close()
})

// Protects: race between the screen's first team list and a failed join (Plan 3 Task 4
// flake): a list response that lands after the join error must not clear the error.
test('wrong code error survives a slow response', async ({ page }) => {
  await page.route('**/api/collections/team_members/records**', async (route) => {
    await new Promise((resolve) => setTimeout(resolve, 1_000))
    await route.continue()
  })
  await page.goto('/')
  await signUpVerifyAndSignIn(page, uniqueEmail(), 'Slow')
  await page.getByRole('button', { name: 'Join with code' }).click()
  await page.getByPlaceholder('Join code').fill('WRONGCODE')
  await page.getByRole('button', { name: 'Join', exact: true }).click()
  await expect(page.getByTestId('form-error')).toHaveText('That join code is not valid.')
  // The delayed team list lands after the join error; the error must still be there.
  await settled(page)
  await expect(page.getByTestId('form-error')).toHaveText('That join code is not valid.')
})

// Protects: invite flow — owner invites, invitee sees the invite on the Teams screen
// (they may have no team yet), accepts, and the team appears.
test('invite flow', async ({ page, browser }) => {
  const inviteeEmail = uniqueEmail()
  await page.goto('/')
  await signUpVerifyAndSignIn(page, uniqueEmail(), 'Owner')
  await createTeam(page, 'Crew')
  const page2 = await browser.newPage()
  await page2.goto('/')
  await signUpVerifyAndSignIn(page2, inviteeEmail, 'Invitee')
  await openTeam(page, 'Crew')
  await page.getByPlaceholder('Email').fill(inviteeEmail)
  await page.getByRole('button', { name: 'Send invite' }).click()
  await expect(page.getByText('Invite sent!')).toBeVisible()
  // The inbox loads when the screen opens, so the invitee reloads to see it
  await page2.reload()
  await expect(page2.getByTestId('invite-inbox')).toContainText('Crew')
  await page2.getByRole('button', { name: 'Accept' }).click()
  await expect(page2.getByTestId('team-list')).toContainText('Crew')
  await expect(page2.getByTestId('invite-inbox')).toHaveCount(0)
  await page2.close()
})

// Protects: remove and delete — owner removes a member, the member loses the team;
// owner deletes the team, it disappears from the owner's list.
test('remove and delete', async ({ page, browser }) => {
  await page.goto('/')
  await signUpVerifyAndSignIn(page, uniqueEmail(), 'Owner')
  await createTeam(page, 'Crew')
  await openTeam(page, 'Crew')
  const joinCode = await enableJoinCode(page)
  const page2 = await browser.newPage()
  await page2.goto('/')
  await signUpVerifyAndSignIn(page2, uniqueEmail(), 'Member')
  await joinWithCode(page2, joinCode, 'Crew')
  // Owner removes the member
  await page.getByRole('button', { name: 'Teams', exact: true }).click()
  await openTeam(page, 'Crew')
  await expect(page.getByTestId('member-list')).toContainText('Member (member)')
  await page.getByRole('button', { name: 'Remove' }).click()
  await expect(page.getByTestId('member-list')).not.toContainText('Member (member)')
  await page2.reload()
  await expect(page2.getByTestId('session-user')).toBeVisible()
  await settled(page2)
  await expect(page2.getByTestId('team-list')).not.toContainText('Crew')
  // Owner deletes the team
  await page.getByRole('button', { name: 'Delete team' }).click()
  await page.getByRole('dialog').getByRole('button', { name: 'Delete team' }).click()
  await expect(page.getByRole('button', { name: 'Create team' })).toBeVisible()
  await settled(page)
  await expect(page.getByTestId('team-list')).not.toContainText('Crew')
  await page2.close()
})

// Protects: owner-only controls — the owner sees invite form, remove and delete
// buttons and the join code; a member sees none of them.
test('only owner sees owner controls', async ({ page, browser }) => {
  await page.goto('/')
  await signUpVerifyAndSignIn(page, uniqueEmail(), 'Owner')
  await createTeam(page, 'Crew')
  await openTeam(page, 'Crew')
  const joinCode = await enableJoinCode(page)
  await expect(page.getByRole('button', { name: 'Send invite' })).toBeVisible()
  await expect(page.getByRole('button', { name: 'Delete team' })).toBeVisible()
  const page2 = await browser.newPage()
  await page2.goto('/')
  await signUpVerifyAndSignIn(page2, uniqueEmail(), 'Member')
  await joinWithCode(page2, joinCode, 'Crew')
  await openTeam(page2, 'Crew')
  await expect(page2.getByTestId('member-list')).toContainText('Owner')
  await expect(page2.getByTestId('join-code')).toHaveCount(0)
  await expect(page2.getByRole('button', { name: 'Send invite' })).toHaveCount(0)
  await expect(page2.getByRole('button', { name: 'Delete team' })).toHaveCount(0)
  await expect(page2.getByRole('button', { name: 'Remove' })).toHaveCount(0)
  await page2.close()
})

test('sign-up and verification gate', async ({ page }) => {
  const email = uniqueEmail()
  await page.goto('/')
  await signUp(page, email, 'Verifier', 'KwntoPass99')
  await expect(page.getByText('Check your email')).toBeVisible()
  // Sign in works but create team is gated
  await page.getByRole('button', { name: 'Sign in' }).first().click()
  await page.getByLabel('Email').fill(email)
  await page.getByLabel('Password').fill('KwntoPass99')
  await page.getByRole('button', { name: 'Sign in' }).click()
  await expect(page.getByText('Verify your email')).toBeVisible()
  await expect(page.getByRole('button', { name: 'Create team' })).toBeDisabled()
  // Verify, then reload: the stored session is refreshed, so the gate lifts (final review, I1)
  await verifyByEmail(email)
  await page.reload()
  await expect(page.getByRole('button', { name: 'Create team' })).toBeEnabled()
  await expect(page.getByText('Verify your email')).toHaveCount(0)
})

// Clicks "Sign in" and waits for the server's answer, so the next attempt cannot start
// before this one is counted (the old error text stays on screen in between).
async function clickAndWaitForSignIn(page: Page): Promise<void> {
  await Promise.all([
    page.waitForResponse((response) => response.url().includes('/auth-with-password')),
    page.getByRole('button', { name: 'Sign in' }).click(),
  ])
}

// Protects: lockout — after 3 wrong passwords the account is locked;
// the lockout message is shown in form-error.
test('lockout after three wrong passwords', async ({ page }) => {
  const email = uniqueEmail()
  await page.goto('/')
  await signUp(page, email, 'Locker', 'KwntoPass99')
  await verifyByEmail(email)
  await page.getByRole('button', { name: 'Sign in' }).first().click()
  // Three wrong attempts — each shows wrong password, not lockout
  for (let i = 0; i < 3; i++) {
    await page.getByLabel('Email').fill(email)
    await page.getByLabel('Password').fill('WrongPass')
    await clickAndWaitForSignIn(page)
    await expect(page.getByTestId('form-error')).toBeVisible()
    await expect(page.getByTestId('form-error')).not.toContainText('Too many')
    await page.getByLabel('Password').clear()
  }
  // Fourth attempt with the right password — should show lockout message
  await page.getByLabel('Password').fill('KwntoPass99')
  await clickAndWaitForSignIn(page)
  await expect(page.getByTestId('form-error')).toContainText('Too many failed sign-in attempts')
})

// Protects: session persistence — a sign-in survives a page reload;
// sign-out clears the session and a reload stays signed out.
test('session survives reload; sign-out clears it', async ({ page }) => {
  const email = uniqueEmail()
  await page.goto('/')
  await signUpVerifyAndSignIn(page, email, 'Session')
  await expect(page.getByTestId('session-user')).toContainText('Session')
  await page.reload()
  await expect(page.getByTestId('session-user')).toContainText('Session')
  await page.getByTestId('session-user').click()
  await page.getByRole('button', { name: 'Sign out' }).click()
  await expect(page.getByRole('button', { name: 'Sign up' })).toBeVisible()
  await page.reload()
  await expect(page.getByRole('button', { name: 'Sign up' })).toBeVisible()
  await expect(page.getByTestId('session-user')).toHaveCount(0)
})
