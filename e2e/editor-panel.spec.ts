// Protects: the properties panel (editor core plan, Task 11; design 6.2 and 9c): title, script
// lines with characters and order, Enter and Backspace in a line, character suggestions, cues,
// connection labels, and text typed just before moving on is saved (Review Focus 3).
import { expect, test, type Locator, type Page } from '@playwright/test'
import { addNodeAt, card, connectNodes, ownerWithProject, readyCanvas, waitForSave } from './helpers/editor'

const panel = (page: Page) => page.getByTestId('editor-panel')
const lineRows = (page: Page) => panel(page).getByTestId('line-row')
const lineText = (page: Page, i: number) => lineRows(page).nth(i).getByLabel('Line text')
const character = (page: Page, i: number) => lineRows(page).nth(i).getByLabel('Character')

/** Types into a field, leaves it and waits for the save of that collection. */
async function typeAndSave(page: Page, field: Locator, text: string, collection: string): Promise<void> {
  const saved = waitForSave(page, collection, 'PATCH')
  await field.fill(text)
  await field.blur()
  await saved
}

async function addLine(page: Page): Promise<void> {
  const count = await lineRows(page).count()
  const saved = waitForSave(page, 'script_lines', 'POST')
  await panel(page).getByRole('button', { name: 'Add line' }).click()
  await saved
  await expect(lineRows(page)).toHaveCount(count + 1)
}

async function oneNode(page: Page): Promise<string> {
  await ownerWithProject(page, 'Story')
  await readyCanvas(page, 0)
  const id = await addNodeAt(page, 40, 60)
  await card(page, id).click()
  await expect(panel(page).getByLabel('Title', { exact: true })).toBeVisible()
  return id
}

// Protects: design 9c: a node's title and its lines (character and text, one record each) and their order are saved.
test('script lines keep their text, characters and order', async ({ page }) => {
  const id = await oneNode(page)
  await typeAndSave(page, panel(page).getByLabel('Title', { exact: true }), 'The Hall', 'nodes')
  const lines: Array<[string, string]> = [['ANNA', 'Hello.'], ['BEN', 'Hi.'], ['', 'They wave.']]
  for (const [i, [who, text]] of lines.entries()) {
    await addLine(page)
    if (who !== '') await typeAndSave(page, character(page, i), who, 'script_lines')
    await typeAndSave(page, lineText(page, i), text, 'script_lines')
  }
  const moved = waitForSave(page, 'script_lines', 'PATCH')
  // Rows are reordered by dragging the grip; Alt+Up on the focused grip is the keyboard way.
  await lineRows(page).nth(2).getByRole('button', { name: 'Drag line' }).focus()
  await page.keyboard.press('Alt+ArrowUp')
  await moved
  await page.reload()
  await readyCanvas(page, 1)
  await expect(card(page, id)).toContainText('The Hall')
  await expect(card(page, id)).toContainText('ANNA: Hello.They wave.BEN: Hi.')
  await card(page, id).click()
  await expect(lineRows(page)).toHaveCount(3)
  await expect(lineText(page, 0)).toHaveValue('Hello.')
  await expect(lineText(page, 1)).toHaveValue('They wave.')
  await expect(character(page, 1)).toHaveValue('')
  await expect(character(page, 2)).toHaveValue('BEN')
})

// Protects: design 9c: Enter adds a line below and focuses it; Backspace in an empty line deletes it and goes back up.
test('Enter adds a line and Backspace removes an empty one', async ({ page }) => {
  await oneNode(page)
  await addLine(page)
  await typeAndSave(page, lineText(page, 0), 'Hello.', 'script_lines')
  const created = waitForSave(page, 'script_lines', 'POST')
  await lineText(page, 0).click()
  await page.keyboard.press('End')
  await page.keyboard.press('Enter')
  await created
  await expect(lineRows(page)).toHaveCount(2)
  await expect(lineText(page, 1)).toBeFocused()
  await expect(lineText(page, 0)).toHaveValue('Hello.')
  const removed = waitForSave(page, 'script_lines', 'DELETE')
  await page.keyboard.press('Backspace')
  await removed
  await expect(lineRows(page)).toHaveCount(1)
  await expect(lineText(page, 0)).toBeFocused()
  await page.reload()
  await readyCanvas(page, 1)
  await page.getByTestId('node-card').click()
  await expect(lineRows(page)).toHaveCount(1)
  await expect(lineText(page, 0)).toHaveValue('Hello.')
})

// Protects: Review Focus 3: text typed and left at once (another node, another chapter) is saved before the 800 ms wait ends.
test('text typed just before moving on is saved', async ({ page }) => {
  const a = await oneNode(page)
  const b = await addNodeAt(page, 320, 60)
  await page.getByRole('button', { name: 'Add chapter' }).click()
  await expect(page.getByRole('tab', { name: 'Chapter 2' })).toBeVisible()
  await page.getByRole('tab', { name: 'Chapter 1' }).click()
  await readyCanvas(page, 2)
  await card(page, a).click()
  await addLine(page)
  // Sent well before the 800 ms timer would send it: only moving on can have sent it.
  const lineSaved = waitForSave(page, 'script_lines', 'PATCH')
  const lineSent = page.waitForRequest((r) => r.method() === 'PATCH' && r.url().includes('/script_lines/records/'), { timeout: 500 })
  await lineText(page, 0).fill('Wait for me.')
  await card(page, b).click()
  await lineSent
  await expect(panel(page).getByLabel('Title', { exact: true })).toBeVisible()
  const titleSaved = waitForSave(page, 'nodes', 'PATCH')
  const titleSent = page.waitForRequest((r) => r.method() === 'PATCH' && r.url().includes(`/nodes/records/${b}`), { timeout: 500 })
  await panel(page).getByLabel('Title', { exact: true }).fill('Second')
  await page.getByRole('tab', { name: 'Chapter 2' }).click()
  await titleSent
  await Promise.all([lineSaved, titleSaved])
  await page.reload()
  await page.getByRole('tab', { name: 'Chapter 1' }).click()
  await readyCanvas(page, 2)
  await expect(card(page, b)).toContainText('Second')
  await expect(card(page, a)).toContainText('Wait for me.')
})

// Protects: design 9c: the character field offers names already used in the project.
test('the character field suggests names already used', async ({ page }) => {
  await oneNode(page)
  await addLine(page)
  await typeAndSave(page, character(page, 0), 'ANNA', 'script_lines')
  await addLine(page)
  await character(page, 1).fill('a')
  await expect(lineRows(page).nth(1).locator('datalist option[value="ANNA"]')).toHaveCount(1)
})

// Protects: design 6.2: cues keep their type; a connection's label is saved and shown; a deleted connection is gone.
test('cues and connection labels are saved', async ({ page }) => {
  const a = await oneNode(page)
  const cueSaved = waitForSave(page, 'cues', 'POST')
  await panel(page).getByRole('button', { name: 'Add cue' }).click()
  await cueSaved
  const typed = waitForSave(page, 'cues', 'PATCH')
  await panel(page).getByTestId('cue-row').first().getByLabel('Cue type').selectOption('lighting')
  await typed
  await typeAndSave(page, panel(page).getByTestId('cue-row').first().getByLabel('Cue text'), 'Lights dim', 'cues')
  const b = await addNodeAt(page, 320, 60)
  // Lower than before: the card now has a row for its choices, so it is taller.
  const c = await addNodeAt(page, 320, 400)
  const toB = await connectNodes(page, a, b)
  const toC = await connectNodes(page, a, c)
  await page.getByTestId(`rf__edge-${toB}`).click()
  await typeAndSave(page, panel(page).getByLabel('Choice text'), 'Open the door', 'connections')
  await expect(page.getByTestId(`rf__edge-${toB}`)).toContainText('Open the door')
  await page.getByTestId(`rf__edge-${toC}`).click()
  const removed = waitForSave(page, 'connections', 'DELETE')
  await panel(page).getByRole('button', { name: 'Delete connection' }).click()
  await removed
  await page.reload()
  await readyCanvas(page, 3)
  await expect(page.locator('.react-flow__edge')).toHaveCount(1)
  await expect(page.getByTestId(`rf__edge-${toB}`)).toContainText('Open the door')
  await card(page, a).click()
  await expect(panel(page).getByTestId('cue-row')).toHaveCount(1)
  await expect(panel(page).getByTestId('cue-row').first().getByLabel('Cue type')).toHaveValue('lighting')
  await expect(panel(page).getByTestId('cue-row').first().getByLabel('Cue text')).toHaveValue('Lights dim')
})
