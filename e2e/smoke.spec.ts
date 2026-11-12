// Protects: the whole chain browser -> Vite proxy -> PocketBase, in both supported browsers.
import { test, expect } from '@playwright/test'

test('the app loads and reaches the backend', async ({ page }) => {
  await page.goto('/')
  await expect(page.getByRole('heading', { name: 'KWNTO' })).toBeVisible()
  await expect(page.getByTestId('backend-status')).toHaveText('Backend: connected')
})
