import { expect, test } from '@playwright/test'
import { addNodeAt, ownerWithProject, readyCanvas } from './helpers/editor'
import { goOffline, syncStatus } from './helpers/offline'

// Protects design 6.7: losing the connection with a project open is a normal event, so it must not raise an uncaught
// error (an unhandled promise rejection from the live-connection client showed as `Something went wrong.` in the
// console and in any error monitor). Found by the M8/M9 walk on 2026-11-26.
test('going offline and back online raises no uncaught error', async ({ page, context }) => {
  const uncaught: string[] = []
  page.on('pageerror', (error) => uncaught.push(error.message))
  await ownerWithProject(page, 'Story')
  await readyCanvas(page, 0)
  await addNodeAt(page, 60, 60)
  await readyCanvas(page, 1)

  await goOffline(context, page)
  // The live connection notices a drop after a moment; give it time to fail before looking.
  await page.waitForTimeout(3000)
  // The helper waits 5 s for "Offline" to clear; after an outage the live connection reconnects on a backoff, so wait longer.
  await context.setOffline(false)
  // The status line is not drawn at all when everything is saved, so count the "Offline" ones instead.
  await expect(syncStatus(page).filter({ hasText: 'Offline' })).toHaveCount(0, { timeout: 20_000 })

  expect(uncaught).toEqual([])
})
