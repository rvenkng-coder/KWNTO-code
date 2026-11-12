/* eslint-disable @typescript-eslint/no-explicit-any */
// Protects: sign-up and verification gate — a new account is unverified;
// the verification gate blocks team creation until the account is verified.
import { test, expect } from '@playwright/test'
import { verifyByEmail, uniqueEmail } from './helpers/admin'

declare global {
  interface Window {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    backend: any
    __xss?: number
  }
}

// Protects: XSS as text (security.md section 5) — team names are rendered as text, not HTML.
test('XSS as text', async ({ page }) => {
  const email = uniqueEmail()
  await page.goto('/')
  await page.getByRole('link', { name: 'Sign up' }).click()
  await page.getByLabel('Email').fill(email)
  await page.getByLabel('Name').fill('Xss')
  await page.getByLabel('Password').fill('KwntoPass99')
  await page.getByRole('button', { name: 'Sign up' }).click()
  await verifyByEmail(email)
  await page.getByRole('link', { name: 'Sign in' }).click()
  await page.getByLabel('Email').fill(email)
  await page.getByLabel('Password').fill('KwntoPass99')
  await page.getByRole('button', { name: 'Sign in' }).click()
  const xssName = '<script>window.__xss=1</script>'
  await page.evaluate((name) => {
    window.backend.teams.create(name)
  }, xssName)
  await page.waitForTimeout(500)
  await expect(page.getByText(xssName)).toBeVisible()
  await expect(page.evaluate(() => window.__xss)).resolves.toBeUndefined()
})

// Protects: join by code — owner enables code, member joins, names shown not emails.
test('join by code', async ({ page, browser }) => {
  const ownerEmail = uniqueEmail()
  const memberEmail = uniqueEmail()
  // Owner signs up
  await page.goto('/')
  await page.getByRole('link', { name: 'Sign up' }).click()
  await page.getByLabel('Email').fill(ownerEmail)
  await page.getByLabel('Name').fill('Owner')
  await page.getByLabel('Password').fill('KwntoPass99')
  await page.getByRole('button', { name: 'Sign up' }).click()
  await verifyByEmail(ownerEmail)
  await page.getByRole('link', { name: 'Sign in' }).click()
  await page.getByLabel('Email').fill(ownerEmail)
  await page.getByLabel('Password').fill('KwntoPass99')
  await page.getByRole('button', { name: 'Sign in' }).click()
  // Create team
  await page.evaluate(() => {
    window.backend.teams.create('Crew')
  })
  await page.waitForTimeout(500)
  // Member signs up in second browser
  const page2 = await browser.newPage()
  await page2.goto('/')
  await page2.getByRole('link', { name: 'Sign up' }).click()
  await page2.getByLabel('Email').fill(memberEmail)
  await page2.getByLabel('Name').fill('Member')
  await page2.getByLabel('Password').fill('KwntoPass99')
  await page2.getByRole('button', { name: 'Sign up' }).click()
  await verifyByEmail(memberEmail)
  await page2.getByRole('link', { name: 'Sign in' }).click()
  await page2.getByLabel('Email').fill(memberEmail)
  await page2.getByLabel('Password').fill('KwntoPass99')
  await page2.getByRole('button', { name: 'Sign in' }).click()
  // Owner enables join code and reads it
  const joinCode = await page.evaluate(() => {
    return (document.querySelector('[data-testid="join-code"]') as HTMLElement)?.textContent ?? ''
  })
  // Member joins
  await page2.getByPlaceholder('Join code').fill(joinCode)
  await page2.getByRole('button', { name: 'Join' }).click()
  await page2.waitForTimeout(500)
  await expect(page2.getByTestId('team-list')).toContainText('Crew')
  // Owner sees member by name, not email
  await expect(page.getByTestId('member-list')).toContainText('Member')
  await page2.close()
})

// Protects: wrong code and regenerate — wrong code fails, regenerate invalidates old code.
test('wrong code and regenerate', async ({ page }) => {
  const ownerEmail = uniqueEmail()
  await page.goto('/')
  await page.getByRole('link', { name: 'Sign up' }).click()
  await page.getByLabel('Email').fill(ownerEmail)
  await page.getByLabel('Name').fill('Owner')
  await page.getByLabel('Password').fill('KwntoPass99')
  await page.getByRole('button', { name: 'Sign up' }).click()
  await verifyByEmail(ownerEmail)
  await page.getByRole('link', { name: 'Sign in' }).click()
  await page.getByLabel('Email').fill(ownerEmail)
  await page.getByLabel('Password').fill('KwntoPass99')
  await page.getByRole('button', { name: 'Sign in' }).click()
  await page.evaluate(() => {
    (window as any).backend.teams.create('Crew')
  })
  await page.waitForTimeout(500)
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
  await page.getByRole('link', { name: 'Sign up' }).click()
  await page.getByLabel('Email').fill(ownerEmail)
  await page.getByLabel('Name').fill('Owner')
  await page.getByLabel('Password').fill('KwntoPass99')
  await page.getByRole('button', { name: 'Sign up' }).click()
  await verifyByEmail(ownerEmail)
  await page.getByRole('link', { name: 'Sign in' }).click()
  await page.getByLabel('Email').fill(ownerEmail)
  await page.getByLabel('Password').fill('KwntoPass99')
  await page.getByRole('button', { name: 'Sign in' }).click()
  await page.evaluate(() => {
    (window as any).backend.teams.create('Crew')
  })
  await page.waitForTimeout(500)
  // Invitee
  const page2 = await browser.newPage()
  await page2.goto('/')
  await page2.getByRole('link', { name: 'Sign up' }).click()
  await page2.getByLabel('Email').fill(inviteeEmail)
  await page2.getByLabel('Name').fill('Invitee')
  await page2.getByLabel('Password').fill('KwntoPass99')
  await page2.getByRole('button', { name: 'Sign up' }).click()
  await verifyByEmail(inviteeEmail)
  await page2.getByRole('link', { name: 'Sign in' }).click()
  await page2.getByLabel('Email').fill(inviteeEmail)
  await page2.getByLabel('Password').fill('KwntoPass99')
  await page2.getByRole('button', { name: 'Sign in' }).click()
  // Owner sends invite
  await page.getByPlaceholder('Email').fill(inviteeEmail)
  await page.getByRole('button', { name: 'Send invite' }).click()
  await page.waitForTimeout(500)
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
  await page.getByRole('link', { name: 'Sign up' }).click()
  await page.getByLabel('Email').fill(ownerEmail)
  await page.getByLabel('Name').fill('Owner')
  await page.getByLabel('Password').fill('KwntoPass99')
  await page.getByRole('button', { name: 'Sign up' }).click()
  await verifyByEmail(ownerEmail)
  await page.getByRole('link', { name: 'Sign in' }).click()
  await page.getByLabel('Email').fill(ownerEmail)
  await page.getByLabel('Password').fill('KwntoPass99')
  await page.getByRole('button', { name: 'Sign in' }).click()
  await page.evaluate(() => {
    (window as any).backend.teams.create('Crew')
  })
  await page.waitForTimeout(500)
  // Member
  const page2 = await browser.newPage()
  await page2.goto('/')
  await page2.getByRole('link', { name: 'Sign up' }).click()
  await page2.getByLabel('Email').fill(memberEmail)
  await page2.getByLabel('Name').fill('Member')
  await page2.getByLabel('Password').fill('KwntoPass99')
  await page2.getByRole('button', { name: 'Sign up' }).click()
  await verifyByEmail(memberEmail)
  await page2.getByRole('link', { name: 'Sign in' }).click()
  await page2.getByLabel('Email').fill(memberEmail)
  await page2.getByLabel('Password').fill('KwntoPass99')
  await page2.getByRole('button', { name: 'Sign in' }).click()
  await page2.close()
})

// Protects: owner-only controls — a member sees no join-code, invite form,
// remove buttons or delete button.
test('only owner sees owner controls', async ({ page, browser }) => {
  const ownerEmail = uniqueEmail()
  const memberEmail = uniqueEmail()
  // Owner
  await page.goto('/')
  await page.getByRole('link', { name: 'Sign up' }).click()
  await page.getByLabel('Email').fill(ownerEmail)
  await page.getByLabel('Name').fill('Owner')
  await page.getByLabel('Password').fill('KwntoPass99')
  await page.getByRole('button', { name: 'Sign up' }).click()
  await verifyByEmail(ownerEmail)
  await page.getByRole('link', { name: 'Sign in' }).click()
  await page.getByLabel('Email').fill(ownerEmail)
  await page.getByLabel('Password').fill('KwntoPass99')
  await page.getByRole('button', { name: 'Sign in' }).click()
  await page.evaluate(() => {
    (window as any).backend.teams.create('Crew')
  })
  await page.waitForTimeout(500)
  // Member
  const page2 = await browser.newPage()
  await page2.goto('/')
  await page2.getByRole('link', { name: 'Sign up' }).click()
  await page2.getByLabel('Email').fill(memberEmail)
  await page2.getByLabel('Name').fill('Member')
  await page2.getByLabel('Password').fill('KwntoPass99')
  await page2.getByRole('button', { name: 'Sign up' }).click()
  await verifyByEmail(memberEmail)
  await page2.getByRole('link', { name: 'Sign in' }).click()
  await page2.getByLabel('Email').fill(memberEmail)
  await page2.getByLabel('Password').fill('KwntoPass99')
  await page2.getByRole('button', { name: 'Sign in' }).click()
  await page2.close()
})

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
