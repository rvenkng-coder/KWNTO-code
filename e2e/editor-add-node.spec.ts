// Protects: the Add node button (editor tabs plan, Task 2): it puts a selected node in the middle
// of the visible canvas, a second click does not hide a node under the first, and the button is
// disabled when no chapter is open.
import { expect, test, type Page } from '@playwright/test'
import { cards, nodePosition, ownerWithProject, readyCanvas, waitForSave } from './helpers/editor'

async function addNode(page: Page): Promise<string> {
  const saved = waitForSave(page, 'nodes', 'POST')
  await page.getByRole('button', { name: 'Add node' }).click()
  return ((await (await saved).json()) as { id: string }).id
}

// Protects: one click makes one saved, selected node near the centre of what the person sees (decision E4).
test('the Add node button puts a selected node in the middle of the canvas', async ({ page }) => {
  await ownerWithProject(page, 'Story')
  await page.getByRole('button', { name: 'Add node' }).focus()
  await expect(page.getByRole('tooltip')).toHaveText('Add node (or double-click the canvas)')
  await addNode(page)
  await expect(cards(page)).toHaveCount(1)
  await expect(page.getByTestId('editor-panel').getByLabel('Title', { exact: true })).toHaveValue('New node')
  const canvas = (await page.getByTestId('canvas').boundingBox())!
  const node = (await cards(page).boundingBox())!
  expect(Math.abs(node.x - (canvas.x + canvas.width / 2))).toBeLessThanOrEqual(40)
  expect(Math.abs(node.y - (canvas.y + canvas.height / 2))).toBeLessThanOrEqual(40)
  await page.reload()
  await readyCanvas(page, 1)
})

// Protects: a second click without moving the view steps 40 px right and down, so two nodes never look like one (Review Focus 4).
test('adding twice places the second node 40 px right and down', async ({ page }) => {
  await ownerWithProject(page, 'Story')
  const first = await addNode(page)
  const second = await addNode(page)
  await expect(cards(page)).toHaveCount(2)
  const a = await nodePosition(page, first)
  const b = await nodePosition(page, second)
  expect({ x: b.x - a.x, y: b.y - a.y }).toEqual({ x: 40, y: 40 })
})

// Protects: with every tab closed the button is disabled, not silently doing nothing (Review Focus 5).
test('Add node is disabled when no chapter is open', async ({ page }) => {
  await ownerWithProject(page, 'Story')
  await page.getByRole('button', { name: 'Close Chapter 1' }).click()
  await expect(page.getByRole('button', { name: 'Add node' })).toBeDisabled()
})
