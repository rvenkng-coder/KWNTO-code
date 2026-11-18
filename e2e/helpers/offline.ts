import { expect, type BrowserContext, type Page } from '@playwright/test'

/** The top bar's sync line of a page. */
export const syncStatus = (page: Page) => page.getByTestId('sync-status')

/** Takes the browser's network away and waits until the page says `Offline`. */
export async function goOffline(context: BrowserContext, page: Page = context.pages()[0]!): Promise<void> {
  await context.setOffline(true)
  await expect(syncStatus(page)).toContainText('Offline')
}

/** Gives the network back and waits until the page no longer says `Offline`. */
export async function goOnline(context: BrowserContext, page: Page = context.pages()[0]!): Promise<void> {
  await context.setOffline(false)
  await expect(syncStatus(page)).not.toContainText('Offline')
}
