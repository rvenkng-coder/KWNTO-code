// Protects: the app shell — the sign-in screen fits a phone, and a reload keeps the place the person was in (hash
// route).
import { test, expect } from '@playwright/test'
import { uniqueEmail } from './helpers/admin'
import { signUpVerifyAndSignIn, createTeam, openTeam } from './helpers/ui'

// Protects: nothing is cut off at 390 px, the email field included.
test('sign-in fits a 390 px wide screen', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 })
  await page.goto('/')
  const box = await page.getByLabel('Email').boundingBox()
  expect(box).not.toBeNull()
  expect(box!.x).toBeGreaterThanOrEqual(0)
  expect(box!.x + box!.width).toBeLessThanOrEqual(390)
  const overflow = await page.evaluate(
    () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
  )
  expect(overflow).toBeLessThanOrEqual(0)
})

// Protects: the open team is part of the address, so a reload shows it again.
test('a reload keeps the open team', async ({ page }) => {
  await page.goto('/')
  await signUpVerifyAndSignIn(page, uniqueEmail(), 'Reloader')
  await createTeam(page, 'Crew')
  await openTeam(page, 'Crew')
  await expect(page).toHaveURL(/#\/team\/[a-z0-9]{15}$/)
  await page.reload()
  await expect(page.getByTestId('member-list')).toHaveAttribute('data-loaded', 'true')
  await expect(page.getByTestId('member-list')).toContainText('Reloader')
})

// Protects: the theme is saved to the account: it survives a reload and follows the
// person into a new browser context (a different device). A new account starts dark.
test('the chosen theme follows the account', async ({ page, browser }) => {
  const email = uniqueEmail()
  await page.goto('/')
  await signUpVerifyAndSignIn(page, email, 'Themer')
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'dark')
  // The theme changes at once and is saved in the background: wait for the save, or the
  // reload below could cancel it.
  const saved = page.waitForResponse(
    (r) => r.url().includes('/user_preferences/') && r.request().method() === 'PATCH' && r.ok(),
  )
  await page.getByRole('switch', { name: 'Dark theme' }).click()
  await saved
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'light')
  await page.reload()
  await expect(page.getByTestId('session-user')).toBeVisible()
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'light')

  const other = await browser.newContext()
  const page2 = await other.newPage()
  await page2.goto('/')
  await page2.getByLabel('Email').fill(email)
  await page2.getByLabel('Password').fill('KwntoPass99')
  await page2.getByRole('button', { name: 'Sign in' }).click()
  await expect(page2.getByTestId('session-user')).toContainText('Themer')
  await expect(page2.locator('html')).toHaveAttribute('data-theme', 'light')
  await other.close()
})
