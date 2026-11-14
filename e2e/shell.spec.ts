// Protects: the app shell (Task 1) — the sign-in screen fits a phone, and a reload
// keeps the place the person was in (hash route, decision D2).
import { test, expect } from '@playwright/test'
import { uniqueEmail } from './helpers/admin'
import { signUpVerifyAndSignIn, createTeam, openTeam } from './helpers/ui'

// Protects: C9, nothing is cut off at 390 px (the email field was, in Plan 2).
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

// Protects: C10, the open team is part of the address, so a reload shows it again.
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
