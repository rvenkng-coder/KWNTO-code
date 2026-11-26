import { expect, test } from '@playwright/test'
import { card, cards, ownerWithProject, readyCanvas } from './helpers/editor'
import { changeRecord, openPlayer, pick, playableProject, playButton, playerDialog } from './helpers/player'

const NOTE = "This choice isn't linked to a node yet."
const TITLE = '<img src=x onerror="window.__xss=1">'
const TEXT = '<script>window.__xss=1</script><b>bold</b>'

// Protects design 6.4 and decision D7: Play is in the title bar, the player is a modal dialog, and closing it returns focus to the button.
test('Play opens the player and Escape closes it', async ({ page }) => {
  await playableProject(page)
  await playButton(page).click()
  await expect(playerDialog(page)).toBeVisible()
  await page.keyboard.press('Escape')
  await expect(playerDialog(page)).toBeHidden()
  await expect(playButton(page)).toBeFocused()
  const dialog = await openPlayer(page)
  await dialog.getByRole('button', { name: 'Close', exact: true }).click()
  await expect(playerDialog(page)).toBeHidden()
})

// Protects design 6.4: play starts at the project's start node, with its chapter, choices and media.
test('the player starts at the start node', async ({ page }) => {
  await playableProject(page)
  const dialog = await openPlayer(page)
  await expect(dialog.getByTestId('player-chapter')).toHaveText('Chapter 1')
  await expect(dialog.getByTestId('player-title')).toHaveText('Gate')
  await expect(dialog.getByTestId('player-choice')).toHaveText(['Open the door', 'Wait'])
  await expect(dialog.getByTestId('player-media')).toHaveCount(1)
  await expect(dialog.getByRole('button', { name: 'Back', exact: true })).toBeDisabled()
})

// Protects Review Focus 3 and design 6.4: lines are screenplay style, a blank line leaves no gap, and cues never reach a player.
test('lines are screenplay style and cues stay out', async ({ page }) => {
  await playableProject(page)
  const dialog = await openPlayer(page)
  const lines = dialog.getByTestId('player-line')
  await expect(lines).toHaveCount(2)
  await expect(lines.nth(0)).toContainText('Mara')
  await expect(lines.nth(0)).toContainText('Who goes there?')
  await expect(lines.nth(1)).toHaveText('Rain falls.')
  await expect(dialog).not.toContainText('Dim the lights')
  await expect(dialog).not.toContainText('lighting')
})

// Protects Review Focus 2 and D5: an unlinked choice is shown, does not move, and says why.
test('an empty choice shows a note and stays', async ({ page }) => {
  await playableProject(page)
  const dialog = await openPlayer(page)
  await dialog.getByTestId('player-choice').filter({ hasText: 'Wait' }).click()
  await expect(dialog.getByTestId('player-note')).toHaveText(NOTE)
  await expect(dialog.getByTestId('player-title')).toHaveText('Gate')
  await expect(dialog.getByTestId('player-choice')).toHaveCount(2)
  await pick(dialog, 'Open the door', 'Door')
  await expect(dialog.getByTestId('player-note')).toHaveCount(0)
})

// Protects design 6.4 and 9b: choices lead on (an empty label shows the target's title), the chapter name shows only when it changes, a path ends with The End.
test('choices lead on, the chapter name shows when it changes and the path ends', async ({ page }) => {
  await playableProject(page)
  const dialog = await openPlayer(page)
  await pick(dialog, 'Open the door', 'Door')
  await expect(dialog.getByTestId('player-chapter')).toHaveCount(0)
  await pick(dialog, 'Garden', 'Garden')
  await expect(dialog.getByTestId('player-chapter')).toHaveText('The Garden')
  await expect(dialog.getByTestId('player-choice')).toHaveCount(0)
  await expect(dialog.getByTestId('player-end')).toHaveText('The End')
})

// Protects Review Focus 1 and D4: with no node there is no start, and the player says so instead of showing an empty screen.
test('a project with no start node says so', async ({ page }) => {
  await ownerWithProject(page, 'Empty')
  await readyCanvas(page, 0)
  const dialog = await openPlayer(page)
  await expect(dialog).toContainText('This project has no start node, so there is nothing to play yet.')
  await expect(dialog.getByTestId('player-title')).toHaveCount(0)
  await dialog.getByRole('button', { name: 'Close', exact: true }).click()
  await expect(playerDialog(page)).toBeHidden()
})

// Protects D6: History lists the path with the choices taken, Back removes one step and Restart starts again.
test('back, restart and the history follow the path', async ({ page }) => {
  await playableProject(page)
  const dialog = await openPlayer(page)
  await pick(dialog, 'Open the door', 'Door')
  await pick(dialog, 'Garden', 'Garden')
  await dialog.getByRole('button', { name: 'History', exact: true }).click()
  const items = dialog.getByTestId('player-history').getByRole('listitem')
  await expect(items).toHaveText(['Gate', 'Open the door → Door', 'Garden → Garden'])
  await expect(items.nth(2)).toHaveAttribute('aria-current', 'step')
  await dialog.getByRole('button', { name: 'Back', exact: true }).click()
  await expect(dialog.getByTestId('player-title')).toHaveText('Door')
  await expect(items).toHaveCount(2)
  await dialog.getByRole('button', { name: 'Restart', exact: true }).click()
  await expect(dialog.getByTestId('player-title')).toHaveText('Gate')
  await expect(items).toHaveCount(1)
})

// Protects Review Focus 5 and security.md 5: HTML in a title, a name, a line and a choice shows as typed text.
test('titles, lines and choices with HTML show as text', async ({ page }) => {
  const story = await playableProject(page)
  await changeRecord('nodes', story.gate, { title: TITLE })
  await changeRecord('script_lines', story.maraLine, { character: TITLE, text: TEXT })
  await changeRecord('connections', story.openChoice, { label: TEXT })
  const dialog = await openPlayer(page)
  await expect(dialog.getByTestId('player-title')).toHaveText(TITLE)
  await expect(dialog.getByTestId('player-line').first()).toContainText(TEXT)
  await expect(dialog.getByTestId('player-choice').first()).toHaveText(TEXT)
  await expect(dialog.locator('b, script, img[src="x"]')).toHaveCount(0)
  expect(await page.evaluate(() => (window as unknown as { __xss?: number }).__xss)).toBeUndefined()
})

// Protects D9: each kind of move has its named transition, and reduced motion switches the animation off.
test('transitions are named and switch off for reduced motion', async ({ page }) => {
  await playableProject(page)
  const dialog = await openPlayer(page)
  const step = dialog.getByTestId('player-step')
  await expect(step).toHaveAttribute('data-transition', 'fade')
  await pick(dialog, 'Open the door', 'Door')
  await expect(step).toHaveAttribute('data-transition', 'slide-forward')
  await dialog.getByRole('button', { name: 'Back', exact: true }).click()
  await expect(step).toHaveAttribute('data-transition', 'slide-back')
  await dialog.getByRole('button', { name: 'Restart', exact: true }).click()
  await expect(step).toHaveAttribute('data-transition', 'fade')
  await expect(step).not.toHaveCSS('animation-name', 'none')
  await page.emulateMedia({ reducedMotion: 'reduce' })
  await expect(step).toHaveCSS('animation-name', 'none')
})

// Protects D1 and D3: the player keeps the story it opened with, a later edit shows only after reopening, and playing writes nothing.
test('the player keeps its story and writes nothing', async ({ page }) => {
  const story = await playableProject(page)
  const writes: string[] = []
  page.on('request', (r) => {
    // The live connection registers its subscriptions with a POST to /api/realtime; that is not a write of data.
    if (r.method() !== 'GET' && r.url().includes('/api/') && !r.url().includes('/api/realtime')) writes.push(`${r.method()} ${r.url()}`)
  })
  const dialog = await openPlayer(page)
  await changeRecord('nodes', story.gate, { title: 'Gate 2' })
  await pick(dialog, 'Open the door', 'Door')
  await pick(dialog, 'Go back', 'Gate')
  await page.keyboard.press('Escape')
  await expect(card(page, story.gate)).toContainText('Gate 2')
  const again = await openPlayer(page)
  await expect(again.getByTestId('player-title')).toHaveText('Gate 2')
  expect(writes).toEqual([])
  await expect(cards(page)).toHaveCount(2)
})

// Protects design 6.4 and D8: audio comes with its node and is gone when the player moves on.
test('audio comes with its node and goes when the node does', async ({ page }) => {
  await playableProject(page)
  const dialog = await openPlayer(page)
  await pick(dialog, 'Open the door', 'Door')
  const audio = dialog.locator('audio')
  await expect(audio).toHaveCount(1)
  await expect(audio).toHaveAttribute('controls', '')
  await expect(audio).toHaveAttribute('autoplay', '')
  await pick(dialog, 'Garden', 'Garden')
  await expect(page.locator('audio')).toHaveCount(0)
})

// Protects D10: Tab stays in the dialog and no key reaches the editor's shortcuts behind it.
test('keys in the player do not reach the editor', async ({ page }) => {
  const story = await playableProject(page)
  await card(page, story.door).click()
  const dialog = await openPlayer(page)
  await page.keyboard.press('Delete')
  await page.keyboard.press('x')
  for (let i = 0; i < 8; i++) {
    await page.keyboard.press(i % 3 === 0 ? 'Shift+Tab' : 'Tab')
    expect(await dialog.evaluate((el) => el.contains(document.activeElement))).toBe(true)
  }
  await page.keyboard.press('Escape')
  await expect(playerDialog(page)).toBeHidden()
  await expect(cards(page)).toHaveCount(2)
})
