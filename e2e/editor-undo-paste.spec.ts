// Protects: undo/redo, copy/paste and shortcuts (editor core plan, Task 12; design 6.1, D5, D11,
// D12): undo and redo of a rename and a new node, undoing a trash brings the node back with its
// connections, a group drag is one step, paste copies across chapters, and undo never
// overwrites a teammate's later change (Review Focus 4).
import { expect, test, type Page } from '@playwright/test'
import { uniqueEmail } from './helpers/admin'
import { addNodeAt, card, cards, connectNodes, nodePosition, openProject, ownerWithProject, readyCanvas, waitForSave } from './helpers/editor'
import { enableJoinCode, joinWithCode, openTeam, signUpVerifyAndSignIn } from './helpers/ui'

const mod = process.platform === 'darwin' ? 'Meta' : 'Control'
const titleField = (page: Page) => page.getByTestId('editor-panel').getByLabel('Title', { exact: true })
const badges = (page: Page, id: string) => card(page, id).getByTestId('node-badge').allTextContents()

async function rename(page: Page, id: string, title: string): Promise<void> {
  await card(page, id).click()
  const saved = waitForSave(page, 'nodes', 'PATCH')
  await titleField(page).fill(title)
  await titleField(page).blur()
  await saved
}

/** Presses a shortcut with the focus on the page, not in a text field, and waits for the save it makes. */
async function press(page: Page, keys: string, collection: string, method: 'POST' | 'PATCH' | 'DELETE' = 'PATCH'): Promise<void> {
  const saved = waitForSave(page, collection, method)
  await page.keyboard.press(keys)
  await saved
}

// Protects: D12: Ctrl+Z undoes a rename and Ctrl+Shift+Z redoes it; undoing a new node trashes it.
test('undo and redo a rename and a new node', async ({ page }) => {
  await ownerWithProject(page, 'Story')
  await readyCanvas(page, 0)
  const id = await addNodeAt(page, 40, 60)
  await rename(page, id, 'Hall')
  await press(page, `${mod}+z`, 'nodes')
  await expect(card(page, id)).toContainText('New node')
  await press(page, `${mod}+Shift+z`, 'nodes')
  await expect(card(page, id)).toContainText('Hall')
  await addNodeAt(page, 320, 60)
  await press(page, `${mod}+z`, 'nodes')
  await expect(cards(page)).toHaveCount(1)
})

// Protects: Review Focus 5: undoing a trash brings the node back with its connections and its Start badge.
test('undoing a trash brings the node back with its connections', async ({ page }) => {
  await ownerWithProject(page, 'Story')
  await readyCanvas(page, 0)
  const a = await addNodeAt(page, 40, 60)
  const b = await addNodeAt(page, 320, 60)
  await connectNodes(page, a, b)
  await card(page, b).click()
  const started = waitForSave(page, 'projects', 'PATCH')
  await page.getByRole('button', { name: 'Make start node' }).click()
  await started
  await card(page, b).click()
  await press(page, 'Delete', 'nodes')
  await expect(cards(page)).toHaveCount(1)
  await press(page, `${mod}+z`, 'nodes')
  await expect(cards(page)).toHaveCount(2)
  await page.reload()
  await readyCanvas(page, 2)
  await expect(page.locator('.react-flow__edge')).toHaveCount(1)
  await expect.poll(() => badges(page, b)).toContain('Start')
})

async function boxSelect(page: Page, ids: string[]): Promise<void> {
  const boxes = await Promise.all(ids.map(async (id) => card(page, id).boundingBox()))
  const left = Math.min(...boxes.map((b) => (b as { x: number }).x)) - 20
  const top = Math.min(...boxes.map((b) => (b as { y: number }).y)) - 20
  const right = Math.max(...boxes.map((b) => (b as { x: number; width: number }).x + (b as { width: number }).width)) + 20
  const bottom = Math.max(...boxes.map((b) => (b as { y: number; height: number }).y + (b as { height: number }).height)) + 20
  await page.keyboard.down('Shift')
  await page.mouse.move(left, top)
  await page.mouse.down()
  await page.mouse.move(right, bottom, { steps: 10 })
  await page.mouse.up()
  await page.keyboard.up('Shift')
}

async function dragCard(page: Page, id: string, dx: number): Promise<void> {
  const box = await card(page, id).boundingBox()
  if (box === null) throw new Error('card not on screen')
  await page.mouse.move(box.x + 40, box.y + 10)
  await page.mouse.down()
  await page.mouse.move(box.x + 40 + dx / 2, box.y + 10, { steps: 8 })
  await page.mouse.move(box.x + 40 + dx, box.y + 10, { steps: 8 })
  await page.mouse.up()
}

// Protects: D5 and D11: a drag of several nodes undoes in one step; paste copies nodes, lines and edges into another chapter, 40 px further each time.
test('a group drag undoes in one step and paste copies across chapters', async ({ page }) => {
  await ownerWithProject(page, 'Story')
  await readyCanvas(page, 0)
  const a = await addNodeAt(page, 40, 60)
  const b = await addNodeAt(page, 300, 60)
  await connectNodes(page, a, b)
  await rename(page, a, 'Alpha')
  const lineSaved = waitForSave(page, 'script_lines', 'POST')
  await page.getByRole('button', { name: 'Add line' }).click()
  await lineSaved
  await rename(page, b, 'Beta')
  const before = [await nodePosition(page, a), await nodePosition(page, b)]
  await boxSelect(page, [a, b])
  await dragCard(page, a, 120)
  await expect.poll(async () => (await nodePosition(page, b)).x).toBeGreaterThan(before[1]?.x ?? 0)
  await page.keyboard.press(`${mod}+z`)
  await expect.poll(async () => [await nodePosition(page, a), await nodePosition(page, b)]).toEqual(before)
  await boxSelect(page, [a, b])
  await page.keyboard.press(`${mod}+c`)
  await page.getByRole('button', { name: 'Add chapter' }).click()
  await page.getByRole('tab', { name: 'Chapter 2' }).click()
  await readyCanvas(page, 0)
  await press(page, `${mod}+v`, 'connections', 'POST')
  await readyCanvas(page, 2)
  await press(page, `${mod}+v`, 'connections', 'POST')
  await readyCanvas(page, 4)
  await expect(page.locator('.react-flow__edge')).toHaveCount(2)
  const alphas = page.locator('[data-testid="node-card"]', { hasText: 'Alpha' })
  await expect(alphas).toHaveCount(2)
  const ids = await alphas.evaluateAll((els) => els.map((e) => e.getAttribute('data-node-id') ?? ''))
  const [p1, p2] = [await nodePosition(page, ids[0] ?? ''), await nodePosition(page, ids[1] ?? '')]
  expect(Math.abs(p2.x - p1.x)).toBe(40)
  expect(Math.abs(p2.y - p1.y)).toBe(40)
  await page.reload()
  await readyCanvas(page, 4)
  await expect(page.locator('.react-flow__edge')).toHaveCount(2)
})

// Protects: Review Focus 4: undo after a teammate changed the same field is refused with a message, and both keep the teammate's title.
test('undo is refused after a teammate changed the same field', async ({ page, browser }) => {
  await ownerWithProject(page, 'Story')
  await readyCanvas(page, 0)
  const id = await addNodeAt(page, 40, 60)
  await page.getByRole('button', { name: 'Back to teams' }).click()
  await openTeam(page, 'Crew')
  const code = await enableJoinCode(page)
  await openProject(page, 'Story')
  await readyCanvas(page, 1)
  const other = await browser.newPage()
  await other.goto('/')
  await signUpVerifyAndSignIn(other, uniqueEmail(), 'Mate')
  await joinWithCode(other, code, 'Crew')
  await openTeam(other, 'Crew')
  await openProject(other, 'Story')
  await readyCanvas(other, 1)
  await rename(page, id, 'Mine')
  await expect(card(other, id)).toContainText('Mine')
  await rename(other, id, 'Theirs')
  await expect(card(page, id)).toContainText('Theirs')
  await page.locator('.react-flow__pane').click({ position: { x: 5, y: 5 } })
  await page.keyboard.press(`${mod}+z`)
  await expect(page.getByRole('alert')).toContainText("Can't undo: someone else changed this since.")
  await expect(card(page, id)).toContainText('Theirs')
  await expect(card(other, id)).toContainText('Theirs')
  await other.close()
})
