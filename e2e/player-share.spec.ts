import { expect, test, type Browser, type Page } from '@playwright/test'
import { uniqueEmail } from './helpers/admin'
import { changeRecord, playableProject, playerDialog, pick } from './helpers/player'
import { makeLink, signInOnLinkScreen, verifiedAccount } from './helpers/share'

const TITLE = '<img src=x onerror="window.__xss=1">'
const TEXT = '<script>window.__xss=1</script><b>bold</b>'
const NOTHING = 'This project has no start node, so there is nothing to play yet.'

async function visitor(browser: Browser): Promise<Page> {
  return (await browser.newContext()).newPage()
}

async function play(guest: Page) {
  await guest.getByRole('button', { name: 'Play', exact: true }).click()
  const dialog = playerDialog(guest)
  await expect(dialog).toBeVisible()
  return dialog
}

// Protects design 5 and 6.4: a person with no account opens a view link, plays from the start node, sees the
// image through the share route, and Close returns to the map.
test('a view link plays the story without an account', async ({ page, browser }) => {
  await playableProject(page)
  const address = await makeLink(page, 'view', 'live')
  const guest = await visitor(browser)
  await guest.goto(address)
  const dialog = await play(guest)
  await expect(dialog.getByTestId('player-title')).toHaveText('Gate')
  await expect(dialog.getByTestId('player-choice')).toHaveText(['Open the door', 'Wait'])
  const image = dialog.getByTestId('player-media')
  await expect.poll(() => image.evaluate((img: HTMLImageElement) => img.naturalWidth)).toBeGreaterThanOrEqual(1)
  await pick(dialog, 'Open the door', 'Door')
  await dialog.getByRole('button', { name: 'Close', exact: true }).click()
  await expect(dialog).toBeHidden()
  await expect(guest.getByTestId('canvas')).toBeVisible()
  await expect(guest.getByRole('button', { name: 'Sign in', exact: true })).toHaveCount(0)
})

// Protects security.md 5: HTML in the story shows as typed text on a share link's player.
test('titles, lines and choices with HTML show as text on a share link', async ({ page, browser }) => {
  const story = await playableProject(page)
  await changeRecord('nodes', story.gate, { title: TITLE })
  await changeRecord('script_lines', story.maraLine, { character: TITLE, text: TEXT })
  await changeRecord('connections', story.openChoice, { label: TEXT })
  const address = await makeLink(page, 'view', 'live')
  const guest = await visitor(browser)
  await guest.goto(address)
  const dialog = await play(guest)
  await expect(dialog.getByTestId('player-title')).toHaveText(TITLE)
  await expect(dialog.getByTestId('player-line').first()).toContainText(TEXT)
  await expect(dialog.getByTestId('player-choice').first()).toHaveText(TEXT)
  await expect(dialog.locator('b, script, img[src="x"]')).toHaveCount(0)
  expect(await guest.evaluate(() => (window as unknown as { __xss?: number }).__xss)).toBeUndefined()
})

// Protects design 5: a snapshot is the project as it was published, so the player shows the old title.
test('a snapshot plays the story as it was published', async ({ page, browser }) => {
  const story = await playableProject(page)
  const address = await makeLink(page, 'view', 'snapshot')
  await changeRecord('nodes', story.gate, { title: 'Gate 2' })
  const guest = await visitor(browser)
  await guest.goto(address)
  const dialog = await play(guest)
  await expect(dialog.getByTestId('player-title')).toHaveText('Gate')
})

// Protects design 5: a comment link signs the person in first, and its media is fetched with their
// token (a blob), because a browser cannot add a header to an audio element.
test("a comment link plays with media loaded under the person's token", async ({ page, browser }) => {
  await playableProject(page)
  const address = await makeLink(page, 'comment', 'live')
  const account = await verifiedAccount(uniqueEmail(), 'Reader')
  const guest = await visitor(browser)
  await guest.goto(address)
  await guest.getByRole('button', { name: 'Sign in', exact: true }).click()
  await signInOnLinkScreen(guest, account)
  const dialog = await play(guest)
  const image = dialog.getByTestId('player-media')
  await expect.poll(() => image.evaluate((img: HTMLImageElement) => img.naturalWidth)).toBeGreaterThanOrEqual(1)
  await pick(dialog, 'Open the door', 'Door')
  const audio = dialog.locator('audio')
  await expect(audio).toHaveCount(1)
  await expect(audio).toHaveAttribute('controls', '')
  await expect.poll(() => audio.evaluate((a: HTMLAudioElement) => a.currentSrc.startsWith('blob:'))).toBe(true)
})

// Protects: when the start node is in the trash the file has no start, and the player says so.
test('a link to a project whose start node is trashed says there is nothing to play', async ({ page, browser }) => {
  const story = await playableProject(page)
  await changeRecord('nodes', story.gate, { deleted_at: new Date().toISOString() })
  const address = await makeLink(page, 'view', 'live')
  const guest = await visitor(browser)
  await guest.goto(address)
  const dialog = await play(guest)
  await expect(dialog).toContainText(NOTHING)
  await expect(dialog.getByTestId('player-title')).toHaveCount(0)
  await expect(dialog.getByRole('button', { name: 'Close', exact: true })).toBeVisible()
})

// Protects: a live view re-reads the project every 30 s, but the open player keeps the story it started with
// and shows the new text only when it is opened again.
test('a live view refresh waits for the player to be reopened', async ({ page, browser }) => {
  const story = await playableProject(page)
  const address = await makeLink(page, 'view', 'live')
  const guest = await visitor(browser)
  await guest.clock.install()
  await guest.goto(address)
  const dialog = await play(guest)
  await expect(dialog.getByTestId('player-title')).toHaveText('Gate')
  await changeRecord('nodes', story.gate, { title: 'Gate 2' })
  const refreshed = guest.waitForResponse((r) => /\/api\/kwnto\/share\/[A-Za-z0-9]+$/.test(r.url()))
  await guest.clock.runFor(35_000)
  await refreshed
  await expect(dialog.getByTestId('player-title')).toHaveText('Gate')
  await expect(async () => {
    await dialog.getByRole('button', { name: 'Close', exact: true }).click()
    const again = await play(guest)
    await expect(again.getByTestId('player-title')).toHaveText('Gate 2', { timeout: 1000 })
  }).toPass()
})
