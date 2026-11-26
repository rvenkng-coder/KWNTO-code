import { expect, test } from '@playwright/test'
import { addNodeAt, ownerWithProject, readyCanvas } from './helpers/editor'
import { goOffline, syncStatus } from './helpers/offline'

// Protects design 6.7: losing the connection with a project open is a normal event, so it must not raise an uncaught
// error (an unhandled promise rejection from the live-connection client showed as `Something went wrong.` in the
// console and in any error monitor).
test('going offline and back online raises no uncaught error', async ({ page, context }) => {
  const uncaught: string[] = []
  page.on('pageerror', (error) => uncaught.push(error.message))
  await ownerWithProject(page, 'Story')
  await readyCanvas(page, 0)
  await addNodeAt(page, 60, 60)
  await readyCanvas(page, 1)

  // The status shows "Offline" once the editor has noticed the drop and begun closing its live subscriptions.
  await goOffline(context, page)
  // The one deliberate fixed wait in this file. The error this test guards against appears a few seconds into the outage
  // (the live-connection client retries and fails), and "nothing is raised" has no event to wait for. Without this wait
  // the test caught the bug in only one of the two browsers. Keep it as short as the failure needs.
  await page.waitForTimeout(3000)
  // The helper waits 5 s for "Offline" to clear; after an outage the live connection reconnects on a backoff, so wait longer.
  // By the time it is back, every close request made while offline has already failed, so a late error would be in the list.
  await context.setOffline(false)
  // The status line is not drawn at all when everything is saved, so count the "Offline" ones instead.
  await expect(syncStatus(page).filter({ hasText: 'Offline' })).toHaveCount(0, { timeout: 20_000 })

  expect(uncaught).toEqual([])
})
