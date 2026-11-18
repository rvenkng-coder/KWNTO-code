// Protects: the canvas (editor core plan, Task 10; design 6.1): nodes and connections are saved,
// a drag saves once on drop, start/end/unreachable markers follow the connections and trashing
// the start node, and the minimap choice is kept with the account.
import { expect, test, type Page } from '@playwright/test'
import { addNodeAt, cards, connectNodes, nodePosition, ownerWithProject, waitForSave } from './helpers/editor'

const card = (page: Page, id: string) => page.locator(`[data-testid="node-card"][data-node-id="${id}"]`)
const badges = (page: Page, id: string) => card(page, id).getByTestId('node-badge').allTextContents()

async function readyCanvas(page: Page, count: number): Promise<void> {
  await expect(page.getByTestId('canvas')).toHaveAttribute('data-ready', 'true')
  await expect(page.getByTestId('canvas')).toHaveAttribute('data-node-count', String(count))
}

// Protects: design 6.1: nodes made by double-click and a connection between them are saved.
test('nodes and a connection survive a reload', async ({ page }) => {
  await ownerWithProject(page, 'Story')
  await readyCanvas(page, 0)
  const a = await addNodeAt(page, 40, 60)
  const b = await addNodeAt(page, 300, 60)
  await connectNodes(page, a, b)
  await expect(page.locator('.react-flow__edge')).toHaveCount(1)
  await page.reload()
  await readyCanvas(page, 2)
  await expect(cards(page)).toHaveCount(2)
  await expect(page.locator('.react-flow__edge')).toHaveCount(1)
})

// Protects: plan Global Constraints and engineering 9: a position is saved on drag end only, once.
test('dragging a node saves its position once when dropped', async ({ page }) => {
  await ownerWithProject(page, 'Story')
  await readyCanvas(page, 0)
  const id = await addNodeAt(page, 40, 60)
  const patches: string[] = []
  page.on('request', (r) => {
    if (r.method() === 'PATCH' && r.url().includes(`/api/collections/nodes/records/${id}`)) patches.push(r.url())
  })
  const start = await nodePosition(page, id)
  const box = await card(page, id).boundingBox()
  if (box === null) throw new Error('card not on screen')
  const saved = waitForSave(page, 'nodes', 'PATCH')
  await page.mouse.move(box.x + 40, box.y + 10)
  await page.mouse.down()
  await page.mouse.move(box.x + 140, box.y + 10, { steps: 10 })
  await page.mouse.move(box.x + 240, box.y + 10, { steps: 10 })
  await page.mouse.up()
  await saved
  const moved = await nodePosition(page, id)
  expect(moved.x - start.x).toBeGreaterThan(150)
  await page.reload()
  await readyCanvas(page, 1)
  expect(await nodePosition(page, id)).toEqual(moved)
  expect(patches).toHaveLength(1)
})

// Protects: design 6.1, D7, D8 and Review Focus 5: markers follow connections; trashing the start node leaves no edge and no crash.
test('markers follow connections and trashing the start node', async ({ page }) => {
  await ownerWithProject(page, 'Story')
  await readyCanvas(page, 0)
  const a = await addNodeAt(page, 40, 60)
  const b = await addNodeAt(page, 300, 60)
  const c = await addNodeAt(page, 40, 280)
  await connectNodes(page, a, b)
  await expect.poll(() => badges(page, a)).toEqual(['Start'])
  expect(await badges(page, b)).toEqual(['End'])
  expect(await badges(page, c)).toEqual(['End', 'Unreachable'])
  await card(page, a).click()
  const trashed = waitForSave(page, 'nodes', 'PATCH')
  await page.keyboard.press('Delete')
  await trashed
  await expect(cards(page)).toHaveCount(2)
  await expect(page.getByTestId('no-start')).toHaveText('No start node: select a node and choose "Make start node".')
  await expect(page.locator('.react-flow__edge')).toHaveCount(0)
  await expect(page.getByTestId('canvas')).toHaveAttribute('data-node-count', '2')
  expect(await badges(page, b)).toEqual(['End', 'Unreachable'])
  await expect(page.getByRole('alert')).toHaveCount(0)
})

// Protects: design 6.1: hiding the minimap is a choice saved with the account, kept after a reload.
test('the minimap choice follows the account', async ({ page }) => {
  await ownerWithProject(page, 'Story')
  await readyCanvas(page, 0)
  await expect(page.locator('.react-flow__minimap')).toBeVisible()
  const saved = waitForSave(page, 'user_preferences', 'PATCH')
  await page.getByRole('button', { name: 'Hide minimap' }).click()
  await saved
  await expect(page.locator('.react-flow__minimap')).toHaveCount(0)
  await page.reload()
  await readyCanvas(page, 0)
  await expect(page.getByRole('button', { name: 'Show minimap' })).toBeVisible()
  await expect(page.locator('.react-flow__minimap')).toHaveCount(0)
})
