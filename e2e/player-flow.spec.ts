import { expect, test, type Locator, type Page } from '@playwright/test'
import { addNodeAt, card, connectNodes, ownerWithProject, readyCanvas, waitForSave } from './helpers/editor'
import { openPlayer, pick, playerDialog } from './helpers/player'
import { makeLink } from './helpers/share'

const panel = (page: Page) => page.getByTestId('editor-panel')

/** Types into a field, leaves it and waits for the save of that collection. */
async function typeAndSave(page: Page, field: Locator, text: string, collection: string): Promise<void> {
  const saved = waitForSave(page, collection, 'PATCH')
  await field.fill(text)
  await field.blur()
  await saved
}

/** Selects a node and gives it a title and one line, all through the properties panel. */
async function writeNode(page: Page, id: string, title: string, who: string, said: string): Promise<void> {
  await card(page, id).click()
  await typeAndSave(page, panel(page).getByLabel('Title', { exact: true }), title, 'nodes')
  const added = waitForSave(page, 'script_lines', 'POST')
  await panel(page).getByRole('button', { name: 'Add line' }).click()
  await added
  const row = panel(page).getByTestId('line-row').first()
  await typeAndSave(page, row.getByLabel('Character'), who, 'script_lines')
  await typeAndSave(page, row.getByLabel('Line text'), said, 'script_lines')
}

// Protects the whole feature end to end (design 6.4 and 8b): nothing is seeded through the admin API, so the story is
// what a person can really make: the first node is the start by the server's own rule, a choice's text is typed in the
// panel, and the player reads that for the author (from the editor) and for a guest (from a view link).
test('a story made by hand plays for its author and for a guest', async ({ page, browser }) => {
  await ownerWithProject(page, 'Hand made')
  await readyCanvas(page, 0)
  const start = await addNodeAt(page, 40, 60)
  const finish = await addNodeAt(page, 420, 60)
  await writeNode(page, start, 'Start', 'Mara', 'Ready?')
  await writeNode(page, finish, 'Finish', 'Mara', 'Done.')
  await connectNodes(page, start, finish)
  await card(page, start).click()
  await typeAndSave(page, panel(page).getByLabel('Choice text').first(), 'Go on', 'connections')

  const dialog = await openPlayer(page)
  await expect(dialog.getByTestId('player-title')).toHaveText('Start')
  await expect(dialog.getByTestId('player-line')).toContainText('Ready?')
  await expect(dialog.getByTestId('player-choice')).toHaveText(['Go on'])
  await pick(dialog, 'Go on', 'Finish')
  await expect(dialog.getByTestId('player-line')).toContainText('Done.')
  await expect(dialog.getByTestId('player-end')).toHaveText('The End')
  await page.keyboard.press('Escape')
  await expect(playerDialog(page)).toBeHidden()

  const address = await makeLink(page, 'view', 'live')
  const guest = await (await browser.newContext()).newPage()
  await guest.goto(address)
  await guest.getByRole('button', { name: 'Play', exact: true }).click()
  const seen = playerDialog(guest)
  await expect(seen.getByTestId('player-title')).toHaveText('Start')
  await expect(seen.getByTestId('player-line')).toContainText('Ready?')
  await pick(seen, 'Go on', 'Finish')
  await expect(seen.getByTestId('player-line')).toContainText('Done.')
  await expect(seen.getByTestId('player-end')).toHaveText('The End')
})
