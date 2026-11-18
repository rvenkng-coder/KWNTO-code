// Protects: the tool strip, Cut, Area select, the collapsible left panel and the scrolling panels
// (editor cards plan, Task 4; design goal 3): every tool shows its shortcut, Cut is one undo step,
// Area select draws a box, the left panel's state survives a reload, and the page never scrolls.
import { expect, test, type Page } from '@playwright/test'
import { addNodeAt, card, cards, nodePosition, ownerWithProject, readyCanvas, waitForSave } from './helpers/editor'

const mod = process.platform === 'darwin' ? 'Meta' : 'Control'
const panel = (page: Page) => page.getByTestId('editor-panel')
const tool = (page: Page, name: string) => page.getByTestId('tool-strip').getByRole('button', { name, exact: true })

const KEY = process.platform === 'darwin' ? (k: string) => `⌘${k}` : (k: string) => `Ctrl+${k}`

// Protects: design goal 3: each tool names its shortcut (⌘ on a Mac) on hover or focus, and the strip is at the canvas's left edge.
test('each tool shows its shortcut in a tooltip', async ({ page }) => {
  await ownerWithProject(page, 'Story')
  const tips: Array<[string, string]> = [
    ['Add node', 'Add node (or double-click the canvas)'],
    ['Cut', `Cut (${KEY('X')})`],
    ['Copy', `Copy (${KEY('C')})`],
    ['Paste', `Paste (${KEY('V')})`],
    ['Move to trash', 'Move to trash (Delete)'],
    ['Area select', 'Area select (or Shift+drag)'],
  ]
  for (const [name, text] of tips) {
    await tool(page, name).focus()
    await expect(page.getByRole('tooltip')).toHaveText(text)
  }
  const strip = (await page.getByTestId('tool-strip').boundingBox())!
  const canvas = (await page.getByTestId('canvas').boundingBox())!
  expect(strip.x).toBeLessThan(canvas.x + 60)
})

// Protects: design goal 3 and D11: Cut copies and trashes as one step, Paste is disabled until something is copied, and undo takes both back.
test('cut moves a node to the clipboard and the trash in one undo step', async ({ page }) => {
  await ownerWithProject(page, 'Story')
  await readyCanvas(page, 0)
  const a = await addNodeAt(page, 40, 60)
  await card(page, a).click()
  await expect(tool(page, 'Cut')).toBeEnabled()
  await expect(tool(page, 'Copy')).toBeEnabled()
  await expect(tool(page, 'Paste')).toBeDisabled()

  const trashed = waitForSave(page, 'nodes', 'PATCH')
  await tool(page, 'Cut').click()
  await trashed
  await expect(cards(page)).toHaveCount(0)
  await expect(tool(page, 'Paste')).toBeEnabled()

  const pasted = waitForSave(page, 'nodes', 'POST')
  await tool(page, 'Paste').click()
  const pastedId = ((await (await pasted).json()) as { id: string }).id
  await expect(cards(page)).toHaveCount(1)
  await page.keyboard.press(`${mod}+z`)
  await expect(card(page, pastedId)).toHaveCount(0)
  await page.keyboard.press(`${mod}+z`)
  await expect(cards(page)).toHaveCount(1)
  await expect(card(page, a)).toHaveCount(1)
})

// Protects: design goal 3 and F5: Area select on draws a selection box; off, a drag pans.
test('area select draws a box that selects the nodes inside', async ({ page }) => {
  await ownerWithProject(page, 'Story')
  await readyCanvas(page, 0)
  const a = await addNodeAt(page, 40, 60)
  const b = await addNodeAt(page, 320, 60)
  await addNodeAt(page, 320, 300)
  await tool(page, 'Area select').click()
  await expect(tool(page, 'Area select')).toHaveAttribute('aria-pressed', 'true')
  const canvas = (await page.getByTestId('canvas').boundingBox())!
  const boxA = (await card(page, a).boundingBox())!
  const boxB = (await card(page, b).boundingBox())!
  const left = Math.min(boxA.x, boxB.x) - 15
  const right = Math.max(boxA.x + boxA.width, boxB.x + boxB.width) + 15
  const top = Math.min(boxA.y, boxB.y) - 15
  const bottom = Math.max(boxA.y + boxA.height, boxB.y + boxB.height) + 15
  expect(left).toBeGreaterThan(canvas.x)
  await page.mouse.move(left, top)
  await page.mouse.down()
  await page.mouse.move(right, bottom, { steps: 10 })
  await page.mouse.up()
  await expect(panel(page)).toContainText('2 nodes selected')

  await tool(page, 'Area select').click()
  await expect(tool(page, 'Area select')).toHaveAttribute('aria-pressed', 'false')
  const before = await nodePosition(page, a)
  const screenBefore = (await card(page, a).boundingBox())!
  await page.mouse.move(canvas.x + canvas.width - 30, canvas.y + 12)
  await page.mouse.down()
  await page.mouse.move(canvas.x + canvas.width - 130, canvas.y + 42, { steps: 8 })
  await page.mouse.up()
  const screenAfter = (await card(page, a).boundingBox())!
  expect(screenAfter.x).toBeLessThan(screenBefore.x - 50)
  expect(await nodePosition(page, a)).toEqual(before)
})

// Protects: design goal 3 and F6: the left panel hides, the canvas takes its width, and the choice is kept in this browser.
test('the left panel collapses and stays collapsed after a reload', async ({ page }) => {
  await ownerWithProject(page, 'Story')
  await readyCanvas(page, 0)
  const wide = (await page.getByTestId('canvas').boundingBox())!.width
  await page.getByRole('button', { name: 'Hide project panel' }).click()
  await expect(page.getByTestId('editor-left')).toHaveCount(0)
  await expect.poll(async () => (await page.getByTestId('canvas').boundingBox())!.width).toBeGreaterThan(wide + 100)
  await page.reload()
  await readyCanvas(page, 0)
  await expect(page.getByTestId('editor-left')).toHaveCount(0)
  await page.getByRole('button', { name: 'Show project panel' }).click()
  await expect(page.getByTestId('editor-left')).toBeVisible()
})

// Protects: design goal 3: a long panel scrolls inside itself and the page never scrolls.
test('a long properties panel scrolls inside itself and the page does not scroll', async ({ page }) => {
  await ownerWithProject(page, 'Story')
  await readyCanvas(page, 0)
  const a = await addNodeAt(page, 40, 60)
  await card(page, a).click()
  const add = panel(page).getByRole('button', { name: 'Add line' })
  await expect(add).toBeVisible()
  for (let i = 0; i < 40; i += 1) {
    const saved = waitForSave(page, 'script_lines', 'POST')
    await add.click()
    await saved
  }
  await expect(panel(page).getByTestId('line-row')).toHaveCount(40)
  const sizes = await panel(page).evaluate((el) => ({ scroll: el.scrollHeight, client: el.clientHeight }))
  expect(sizes.scroll).toBeGreaterThan(sizes.client)
  const page_ = await page.evaluate(() => ({ doc: document.documentElement.scrollHeight, win: window.innerHeight }))
  expect(page_.doc).toBe(page_.win)
})
