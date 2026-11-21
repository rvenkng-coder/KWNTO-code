// Protects: the whole chain browser -> Vite proxy -> PocketBase, in both supported browsers.
import { test, expect } from '@playwright/test'

test('the app loads and shows no backend status line', async ({ page }) => {
  await page.goto('/')
  await expect(page.getByRole('heading', { name: 'KWNTO' })).toBeVisible()
  await expect(page.getByTestId('backend-status')).toHaveCount(0)
})
