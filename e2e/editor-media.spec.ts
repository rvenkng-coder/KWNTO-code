import { expect, test, type Browser, type Page } from '@playwright/test'
import { uniqueEmail } from './helpers/admin.ts'
import { addNodeAt, card, createProject, openProject, ownerWithProject, readyCanvas, waitForSave } from './helpers/editor.ts'
import { PNG_1PX, sampleBytes, setQuotaOverride } from './helpers/media.ts'
import { goOffline } from './helpers/offline.ts'
import { createTeam, enableJoinCode, joinWithCode, openTeam, signUpVerifyAndSignIn } from './helpers/ui.ts'

const panel = (page: Page) => page.getByTestId('editor-panel')
const mediaItems = (page: Page) => panel(page).getByTestId('media-item')
const storageMeter = (page: Page) => panel(page).getByTestId('storage-meter')
const alertBox = (page: Page) => panel(page).getByRole('alert')

async function setupNode(page: Page, title = 'Story'): Promise<string> {
  await ownerWithProject(page, title)
  await readyCanvas(page, 0)
  const id = await addNodeAt(page, 40, 60)
  await card(page, id).click()
  await expect(panel(page).getByLabel('Title', { exact: true })).toBeVisible()
  return id
}

async function ownerAndMember(page: Page, browser: Browser): Promise<{ a: Page; b: Page }> {
  await page.goto('/')
  await signUpVerifyAndSignIn(page, uniqueEmail(), 'Owner')
  await createTeam(page, 'Crew')
  await openTeam(page, 'Crew')
  const code = await enableJoinCode(page)
  await createProject(page, 'Story')
  const b = await (await browser.newContext()).newPage()
  await b.goto('/')
  await signUpVerifyAndSignIn(b, uniqueEmail(), 'Member')
  await joinWithCode(b, code, 'Crew')
  await openTeam(b, 'Crew')
  await openProject(b, 'Story')
  await openProject(page, 'Story')
  await readyCanvas(page, 0)
  await readyCanvas(b, 0)
  return { a: page, b }
}

// Protects: design 6.2: image upload, display as thumbnail, persistence across reload.
test('an uploaded image shows on its node and stays after reload', async ({ page }) => {
  await setupNode(page)
  const input = panel(page).getByLabel('Add media')
  const saved = waitForSave(page, 'media', 'POST')
  await input.setInputFiles({ name: 'a.png', mimeType: 'image/png', buffer: PNG_1PX })
  await saved

  await expect(mediaItems(page)).toHaveCount(1)
  const item = mediaItems(page).first()
  await expect(item).toContainText('a.png')
  const img = item.locator('img')
  await expect(img).toBeVisible()
  const naturalWidth = await img.evaluate((el: HTMLImageElement) => el.naturalWidth)
  expect([1, 100]).toContain(naturalWidth)

  await page.reload()
  await readyCanvas(page, 1)
  await card(page, (await page.locator('[data-node-id]').first().getAttribute('data-node-id'))!).click()
  await expect(mediaItems(page)).toHaveCount(1)
  await expect(mediaItems(page).first()).toContainText('a.png')
})

// Protects: design 6.2: audio plays in place with file URL and fresh token; video is off by decision
// (plan 2026-11-21-node-links D1), so the picker does not offer it and a chosen mp4 is refused clearly.
test('audio files get players and video is refused', async ({ page }) => {
  await setupNode(page)
  const input = panel(page).getByLabel('Add media')

  const accept = (await input.getAttribute('accept')) ?? ''
  expect(accept).not.toContain('mp4')
  expect(accept).not.toContain('mov')

  const savedMp3 = waitForSave(page, 'media', 'POST')
  await input.setInputFiles({ name: 'line.mp3', mimeType: 'audio/mpeg', buffer: sampleBytes('mp3', 200) })
  await savedMp3

  await input.setInputFiles({ name: 'clip.mp4', mimeType: 'video/mp4', buffer: sampleBytes('mp4', 200) })
  await expect(alertBox(page)).toHaveText('This file type is not allowed. Allowed: WAV, MP3, JPEG, PNG.')

  await expect(mediaItems(page)).toHaveCount(1)
  const audio = panel(page).locator('audio[controls]')
  await expect(audio).toBeVisible()
  await expect(panel(page).locator('video[controls]')).toHaveCount(0)
  expect(await audio.getAttribute('src')).toMatch(/token=/)
})

// Protects: Review Focus 2: server magic bytes check refuses forged extensions with clear message.
test('a file whose contents do not match is refused with a clear message', async ({ page }) => {
  await setupNode(page)
  const input = panel(page).getByLabel('Add media')
  const meterBefore = await storageMeter(page).textContent()

  await input.setInputFiles({ name: 'song.mp3', mimeType: 'audio/mpeg', buffer: PNG_1PX })
  await expect(alertBox(page)).toHaveText('This file is not a real MP3 file.')
  await expect(mediaItems(page)).toHaveCount(0)
  await expect(storageMeter(page)).toHaveText(meterBefore ?? '')
})

// Protects: Review Focus 2 and D2: browser early check refuses disallowed extensions before sending.
test('a file the browser can already refuse is never sent', async ({ page }) => {
  await setupNode(page)
  const input = panel(page).getByLabel('Add media')

  let requestSent = false
  page.on('request', (req) => {
    if (req.url().includes('/api/collections/media/records')) {
      requestSent = true
    }
  })

  await input.setInputFiles({ name: 'test.gif', mimeType: 'image/gif', buffer: Buffer.from('GIF89a') })
  await expect(alertBox(page)).toHaveText('This file type is not allowed. Allowed: WAV, MP3, JPEG, PNG.')
  expect(requestSent).toBe(false)
})

// Protects: Review Focus 5: quota enforcement stops upload and frees/deletes nothing.
test('over the quota an upload is refused and nothing is deleted', async ({ page }) => {
  const { email } = await ownerWithProject(page, 'Story')
  await setQuotaOverride(email, 100)
  await readyCanvas(page, 0)
  const id = await addNodeAt(page, 40, 60)
  await card(page, id).click()

  const input = panel(page).getByLabel('Add media')
  const saved = waitForSave(page, 'media', 'POST')
  await input.setInputFiles({ name: 'first.png', mimeType: 'image/png', buffer: PNG_1PX })
  await saved

  await expect(mediaItems(page)).toHaveCount(1)
  await expect(storageMeter(page)).toHaveText('Team storage: 1 KB of 1 KB used')

  // Second upload pushes over quota
  await input.setInputFiles({ name: 'second.png', mimeType: 'image/png', buffer: PNG_1PX })
  await expect(alertBox(page)).toHaveText(
    'Not enough storage: this file is 1 KB and you have 1 KB of 1 KB left. Nothing was deleted.',
  )
  await expect(mediaItems(page)).toHaveCount(1)
  await expect(mediaItems(page).first()).toContainText('first.png')
  await expect(storageMeter(page)).toHaveText('Team storage: 1 KB of 1 KB used')
})

const removedItems = (page: Page) => panel(page).getByTestId('removed-media-item')

// Protects: D8 and the lead's storage rule: removing asks first (inline), hides the file, keeps
// its space used; the lead then restores it or deletes it for good, which frees the space.
test('removing a file hides it and only deleting for good frees its space', async ({ page }) => {
  await setupNode(page)
  page.on('dialog', () => {
    throw new Error('Browser dialog fired unexpectedly')
  })

  const input = panel(page).getByLabel('Add media')
  const meterBefore = await storageMeter(page).textContent()

  const saved = waitForSave(page, 'media', 'POST')
  await input.setInputFiles({ name: 'a.png', mimeType: 'image/png', buffer: PNG_1PX })
  await saved
  await expect(mediaItems(page)).toHaveCount(1)
  // The meter follows the upload a moment later; wait for the real reading before comparing against it.
  await expect(storageMeter(page)).not.toHaveText(meterBefore ?? '')
  const meterWithFile = await storageMeter(page).textContent()

  const item = mediaItems(page).first()
  await item.getByRole('button', { name: 'Remove' }).click()
  await expect(item).toContainText('Remove a.png from this node? The team lead can bring it back.')

  // Cancel keeps the file
  await item.getByRole('button', { name: 'Cancel' }).click()
  await expect(mediaItems(page)).toHaveCount(1)

  // Confirm: it leaves the node but still uses the lead's storage
  const removed = waitForSave(page, 'media', 'PATCH')
  await item.getByRole('button', { name: 'Remove' }).click()
  await item.getByRole('button', { name: 'Remove' }).click()
  await removed
  await expect(mediaItems(page)).toHaveCount(0)
  await expect(removedItems(page)).toHaveCount(1)
  await expect(storageMeter(page)).toHaveText(meterWithFile ?? '')

  // The lead restores it
  const restored = waitForSave(page, 'media', 'PATCH')
  await removedItems(page).first().getByRole('button', { name: 'Restore' }).click()
  await restored
  await expect(mediaItems(page)).toHaveCount(1)
  await expect(removedItems(page)).toHaveCount(0)

  // Remove again, then delete for good (asks first): the space is freed
  await mediaItems(page).first().getByRole('button', { name: 'Remove' }).click()
  const removedAgain = waitForSave(page, 'media', 'PATCH')
  await mediaItems(page).first().getByRole('button', { name: 'Remove' }).click()
  await removedAgain
  const removedItem = removedItems(page).first()
  await removedItem.getByRole('button', { name: 'Delete for good' }).click()
  await expect(removedItem).toContainText('Delete a.png for good? This cannot be undone.')
  const deleted = waitForSave(page, 'media', 'DELETE')
  await removedItem.getByRole('button', { name: 'Delete for good' }).click()
  await deleted
  await expect(removedItems(page)).toHaveCount(0)
  await expect(storageMeter(page)).toHaveText(meterBefore ?? '')
})

// Protects: Review Focus live updates and the lead's storage rule: a member's upload shows live,
// the member's removal hides it live, only the lead sees it as removed, and the member never
// gets a delete or restore control.
test("a teammate's upload and removal appear without a reload, and only the lead can delete", async ({ page, browser }) => {
  const { a, b } = await ownerAndMember(page, browser)
  const nodeId = await addNodeAt(a, 40, 60)
  await expect(card(b, nodeId)).toBeVisible()

  await card(a, nodeId).click()
  await card(b, nodeId).click()
  await expect(panel(a).getByTestId('media-section')).toBeVisible()
  await expect(panel(b).getByTestId('media-section')).toBeVisible()

  // Member b uploads
  const saved = waitForSave(b, 'media', 'POST')
  await panel(b).getByLabel('Add media').setInputFiles({ name: 'b.png', mimeType: 'image/png', buffer: PNG_1PX })
  await saved

  // Owner a sees it live, on the lead's meter too
  await expect(mediaItems(a)).toHaveCount(1)
  await expect(mediaItems(a).first()).toContainText('b.png')
  await expect(storageMeter(b)).toHaveText(await storageMeter(a).textContent() ?? '')

  // Member b removes it
  const removed = waitForSave(b, 'media', 'PATCH')
  const bItem = mediaItems(b).first()
  await bItem.getByRole('button', { name: 'Remove' }).click()
  await bItem.getByRole('button', { name: 'Remove' }).click()
  await removed

  // Owner a sees it leave the node and appear in the removed list; the member sees no removed list
  await expect(mediaItems(a)).toHaveCount(0)
  await expect(removedItems(a)).toHaveCount(1)
  await expect(mediaItems(b)).toHaveCount(0)
  await expect(removedItems(b)).toHaveCount(0)
  await expect(panel(b).getByRole('button', { name: /Delete|Restore/ })).toHaveCount(0)
})

// Protects: offline sync plan D6 applied to media: a file a teammate uploads while I am offline shows up
// when I am back, without a reload (the media list is loaded again on reconnect).
test('media uploaded while I was offline appears when I am back', async ({ page, browser }) => {
  const { a, b } = await ownerAndMember(page, browser)
  const nodeId = await addNodeAt(a, 40, 60)
  await expect(card(b, nodeId)).toBeVisible()
  await card(a, nodeId).click()
  await card(b, nodeId).click()
  await expect(panel(a).getByTestId('media-section')).toBeVisible()

  await goOffline(a.context(), a)
  const saved = waitForSave(b, 'media', 'POST')
  await panel(b).getByLabel('Add media').setInputFiles({ name: 'later.png', mimeType: 'image/png', buffer: PNG_1PX })
  await saved

  await a.context().setOffline(false)
  await expect(mediaItems(a)).toHaveCount(1)
  await expect(mediaItems(a).first()).toContainText('later.png')
})

// Protects: D9: uploads wait for connection; disabled and offline copy shown.
test('uploads wait for the connection', async ({ page, context }) => {
  await setupNode(page)
  const input = panel(page).getByLabel('Add media')
  await expect(input).toBeEnabled()

  await context.setOffline(true)
  await expect(input).toBeDisabled()
  await expect(panel(page).getByText('Uploads need a connection. Try again when you are back online.')).toBeVisible()

  await context.setOffline(false)
  await expect(input).toBeEnabled()
  await expect(panel(page).getByText('Uploads need a connection. Try again when you are back online.')).not.toBeVisible()
})
