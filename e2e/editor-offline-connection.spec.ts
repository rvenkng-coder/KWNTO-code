// Protects plan 2026-11-20-sharing Task 7 (D15, carried over from the offline sync plan): the
// top bar follows the live connection and not only the browser's online flag, a waiting edit
// is sent as soon as the connection is back instead of on the backoff, and edits made offline
// undo one step at a time. The stream is cut without `setOffline`, so the browser stays online.
import { expect, test, type Page } from '@playwright/test'
import { adminRecord } from './helpers/admin'
import { addNodeAt, card, ownerWithProject, readyCanvas } from './helpers/editor'
import { syncStatus } from './helpers/offline'
import { rename } from './helpers/pair'

const STREAM = '**/api/realtime'

// Remembers every EventSource the page opens, so a test can end the open stream. Must run before the page loads.
async function trackStreams(page: Page): Promise<void> {
  await page.addInitScript(() => {
    const Native = window.EventSource
    const all: EventSource[] = []
    ;(window as unknown as { __streams: EventSource[] }).__streams = all
    window.EventSource = class extends Native {
      constructor(url: string | URL, init?: EventSourceInit) {
        super(url, init)
        all.push(this)
      }
    } as typeof EventSource
  })
}

// Refuses new streams and ends the open one the way a dropped connection does (the SDK hears an error).
async function cutStream(page: Page): Promise<void> {
  await page.route(STREAM, (route) => route.abort())
  await page.evaluate(() => {
    for (const source of (window as unknown as { __streams: EventSource[] }).__streams) {
      source.close()
      source.dispatchEvent(new Event('error'))
    }
  })
}

async function projectWithNode(page: Page): Promise<string> {
  await trackStreams(page)
  await ownerWithProject(page, 'Story')
  await readyCanvas(page, 0)
  return addNodeAt(page, 40, 60)
}

// Protects D15: with no edit at all, a live connection that drops (the browser still online) shows
// `Offline` within five seconds, and it clears without a reload once the stream is let through.
test('a dropped live connection shows Offline without an edit', async ({ page }) => {
  await projectWithNode(page)
  await expect(syncStatus(page)).toHaveCount(0)
  await cutStream(page)
  await expect(syncStatus(page)).toContainText('Offline', { timeout: 5000 })
  await page.unroute(STREAM)
  await expect(syncStatus(page)).toHaveCount(0, { timeout: 8000 })
})

// Protects D15: an edit made while the connection is down waits, and goes within three seconds of
// the connection coming back, not on the 30 s backoff.
test('a waiting edit is sent as soon as the connection is back', async ({ page }) => {
  const id = await projectWithNode(page)
  await page.route('**/api/collections/**', (route) => route.abort())
  await cutStream(page)
  await expect(syncStatus(page)).toContainText('Offline', { timeout: 5000 })
  await rename(page, id, 'Waited')
  await expect(syncStatus(page)).toContainText('waiting')
  expect((await adminRecord('nodes', id)).title).not.toBe('Waited')

  await page.unroute('**/api/collections/**')
  await page.unroute(STREAM)
  await expect.poll(async () => (await adminRecord('nodes', id)).title, { timeout: 8000 }).toBe('Waited')
  await expect(card(page, id)).toContainText('Waited')
})
