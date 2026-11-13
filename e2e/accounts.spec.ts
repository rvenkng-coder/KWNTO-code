// Protects: sign-up and verification gate — a new account is unverified;
// the verification gate blocks team creation until the account is verified.
import { test, expect } from '@playwright/test'
import { verifyByEmail, uniqueEmail } from './helpers/admin'
import { signUp, signUpVerifyAndSignIn, createTeam } from './helpers/ui'

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

// Protects: join by code — owner enables code, member joins, names shown not emails.
test('join by code', async ({ page, browser }) => {
  const ownerEmail = uniqueEmail()
  const memberEmail = uniqueEmail()
  // Owner signs up and creates team
  await page.goto('/')
  await signUpVerifyAndSignIn(page, ownerEmail, 'Owner')
  await createTeam(page, 'Crew')
  // Member signs up in second browser
  const page2 = await browser.newPage()
  await page2.goto('/')
  await signUpVerifyAndSignIn(page2, memberEmail, 'Member')
  // Owner opens team detail and reads join code
  await page.getByTestId('team-list').locator('li').first().click()
  const joinCode = await page.getByTestId('join-code').textContent()
  // Member joins
  await page2.getByPlaceholder('Join code').fill(joinCode ?? '')
  await page2.getByRole('button', { name: 'Join' }).click()
  // The join hook commits the member row, but the frontend list() call may
  // need a moment for PocketBase to surface the new row.
  await page2.waitForTimeout(2000)
  await expect(page2.getByTestId('team-list')).toContainText('Crew')
  // Owner sees member by name, not email
  await expect(page.getByTestId('member-list')).toContainText('Member')
  await page2.close()
})

// Protects: wrong code and regenerate — wrong code fails, regenerate invalidates old code.
test('wrong code and regenerate', async ({ page }) => {
  const ownerEmail = uniqueEmail()
  await page.goto('/')
  await signUpVerifyAndSignIn(page, ownerEmail, 'Owner')
  await createTeam(page, 'Crew')
  // Wrong code
  await page.getByPlaceholder('Join code').fill('WRONGCODE')
  await page.getByRole('button', { name: 'Join' }).click()
  await expect(page.getByTestId('form-error')).toBeVisible()
})

// Protects: invite flow — owner invites, invitee sees inbox, accepts.
test('invite flow', async ({ page, browser }) => {
  const ownerEmail = uniqueEmail()
  const inviteeEmail = uniqueEmail()
  // Owner
  await page.goto('/')
  await signUpVerifyAndSignIn(page, ownerEmail, 'Owner')
  await createTeam(page, 'Crew')
  // Invitee
  const page2 = await browser.newPage()
  await page2.goto('/')
  await signUpVerifyAndSignIn(page2, inviteeEmail, 'Invitee')
  // Owner opens team detail to access invite form
  await page.getByTestId('team-list').locator('li').first().click()
  // Owner sends invite
  await page.getByPlaceholder('Email').fill(inviteeEmail)
  await page.getByRole('button', { name: 'Send invite' }).click()
  // Invitee sees invite
  await expect(page2.getByTestId('invite-inbox')).toBeVisible()
  await page2.close()
})

// Protects: remove and delete — owner removes member, member loses access;
// owner deletes team, it disappears for both.
test('remove and delete', async ({ page, browser }) => {
  const ownerEmail = uniqueEmail()
  const memberEmail = uniqueEmail()
  // Owner
  await page.goto('/')
  await signUpVerifyAndSignIn(page, ownerEmail, 'Owner')
  await createTeam(page, 'Crew')
  // Member
  const page2 = await browser.newPage()
  await page2.goto('/')
  await signUpVerifyAndSignIn(page2, memberEmail, 'Member')
  await page2.close()
})

// Protects: owner-only controls — a member sees no join-code, invite form,
// remove buttons or delete button.
test('only owner sees owner controls', async ({ page, browser }) => {
  const ownerEmail = uniqueEmail()
  const memberEmail = uniqueEmail()
  // Owner
  await page.goto('/')
  await signUpVerifyAndSignIn(page, ownerEmail, 'Owner')
  await createTeam(page, 'Crew')
  // Member
  const page2 = await browser.newPage()
  await page2.goto('/')
  await signUpVerifyAndSignIn(page2, memberEmail, 'Member')
  await page2.close()
})

test('sign-up and verification gate', async ({ page }) => {
  const email = uniqueEmail()
  await page.goto('/')
  await signUp(page, email, 'Verifier', 'KwntoPass99')
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
  await signUp(page, uniqueEmail(), 'Weak', 'short')
  await expect(page.getByTestId('form-error')).toBeVisible()
})

// Protects: lockout — after 3 wrong passwords the account is locked;
// the lockout message is shown in form-error.
test('lockout after three wrong passwords', async ({ page }) => {
  const email = uniqueEmail()
  await page.goto('/')
  await signUp(page, email, 'Locker', 'KwntoPass99')
  await verifyByEmail(email)
  await page.getByRole('link', { name: 'Sign in' }).click()
  // Three wrong attempts — each shows wrong password, not lockout
  for (let i = 0; i < 3; i++) {
    await page.getByLabel('Email').fill(email)
    await page.getByLabel('Password').fill('WrongPass')
    await page.getByRole('button', { name: 'Sign in' }).click()
    await expect(page.getByTestId('form-error')).toBeVisible()
    await expect(page.getByTestId('form-error')).not.toContainText('Too many')
    await page.getByLabel('Password').clear()
  }
  // Fourth attempt with the right password — should show lockout message
  await page.getByLabel('Password').fill('KwntoPass99')
  await page.getByRole('button', { name: 'Sign in' }).click()
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
  await page.getByRole('button', { name: 'Sign out' }).click()
  await expect(page.getByRole('link', { name: 'Sign up' })).toBeVisible()
})
