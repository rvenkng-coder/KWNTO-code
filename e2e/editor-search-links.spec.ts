// Protects: search and cross-chapter links (editor core plan, Task 13; design 6.1): header search
// jumps to a node in another chapter, a link to another chapter shows a tag that jumps to its
// target, and a trashed target leaves no tag until undone (Review Focus 5).
import { expect, test, type Page } from '@playwright/test'
import { addNodeAt, card, ownerWithProject, readyCanvas, waitForSave } from './helpers/editor'

const mod = process.platform === 'darwin' ? 'Meta' : 'Control'
const panel = (page: Page) => page.getByTestId('editor-panel')
const tab = (page: Page, name: string) => page.getByRole('tab', { name })

async function rename(page: Page, id: string, title: string): Promise<void> {
  await card(page, id).click()
  const saved = waitForSave(page, 'nodes', 'PATCH')
  const field = panel(page).getByLabel('Title', { exact: true })
  await field.fill(title)
  await field.blur()
  await saved
}

/** Chapter 1 with node A ("Gate") and "Doorway"; Chapter 2 with "The Door"; back on Chapter 1. */
async function twoChapters(page: Page): Promise<{ a: string; door: string }> {
  await ownerWithProject(page, 'Story')
  await readyCanvas(page, 0)
  const a = await addNodeAt(page, 40, 60)
  await rename(page, a, 'Gate')
  const doorway = await addNodeAt(page, 320, 60)
  await rename(page, doorway, 'Doorway')
  const created = waitForSave(page, 'chapters', 'POST')
  await page.getByRole('button', { name: 'Add chapter' }).click()
  await created
  await tab(page, 'Chapter 2').click()
  await readyCanvas(page, 0)
  const door = await addNodeAt(page, 60, 80)
  await rename(page, door, 'The Door')
  await tab(page, 'Chapter 1').click()
  await readyCanvas(page, 2)
  return { a, door }
}

async function expectSelectedInView(page: Page, id: string): Promise<void> {
  await expect(page.locator(`.react-flow__node[data-id="${id}"]`)).toHaveClass(/selected/)
  await expect(panel(page).getByLabel('Title', { exact: true })).toHaveValue('The Door')
  const canvas = await page.getByTestId('canvas').boundingBox()
  const box = await card(page, id).boundingBox()
  if (canvas === null || box === null) throw new Error('not on screen')
  expect(box.x).toBeGreaterThanOrEqual(canvas.x)
  expect(box.x + box.width).toBeLessThanOrEqual(canvas.x + canvas.width)
  expect(box.y).toBeGreaterThanOrEqual(canvas.y)
  expect(box.y + box.height).toBeLessThanOrEqual(canvas.y + canvas.height)
}

// Protects: design 6.1: header search finds a node by title across chapters and jumps there with the keyboard, reopening a closed tab.
test('search jumps to a node in another chapter', async ({ page }) => {
  const { door } = await twoChapters(page)
  await page.getByRole('button', { name: 'Close Chapter 2' }).click()
  await expect(tab(page, 'Chapter 2')).toHaveCount(0)
  await page.locator('.react-flow__pane').click({ position: { x: 5, y: 5 } })
  await page.keyboard.press(`${mod}+k`)
  await expect(page.getByTestId('search-input')).toBeFocused()
  await page.keyboard.type('door')
  const results = page.getByTestId('search-results').getByRole('button')
  await expect(results).toHaveText(['Doorway · Chapter 1', 'The Door · Chapter 2'])
  await page.keyboard.press('ArrowDown')
  await page.keyboard.press('Enter')
  await expect(tab(page, 'Chapter 2')).toHaveAttribute('aria-selected', 'true')
  await readyCanvas(page, 1)
  await expectSelectedInView(page, door)
  await expect(page.getByTestId('search-results')).toHaveCount(0)
})

// Protects: design 6.1: a link to a node in another chapter shows the tag "→ Chapter 2: The Door", which jumps to the target; it survives a reload.
test('a cross-chapter link shows a tag that jumps to its target', async ({ page }) => {
  const { a, door } = await twoChapters(page)
  await card(page, a).click()
  await panel(page).getByRole('button', { name: 'Link to another chapter' }).click()
  await panel(page).getByLabel('Find a node').fill('door')
  const picks = panel(page).getByTestId('picker-results').getByRole('button')
  await expect(picks).toHaveText(['The Door · Chapter 2'])
  const linked = waitForSave(page, 'connections', 'POST')
  await picks.first().click()
  await linked
  await expect(card(page, a).getByTestId('cross-link')).toHaveText('→ Chapter 2: The Door')
  await card(page, a).getByTestId('cross-link').click()
  await expect(tab(page, 'Chapter 2')).toHaveAttribute('aria-selected', 'true')
  await readyCanvas(page, 1)
  await expectSelectedInView(page, door)
  await expect(card(page, door).getByTestId('node-badge')).not.toContainText(['Unreachable'])
  await page.reload()
  await readyCanvas(page, 1)
  await tab(page, 'Chapter 1').click()
  await readyCanvas(page, 2)
  await expect(card(page, a).getByTestId('cross-link')).toHaveText('→ Chapter 2: The Door')
})

// Protects: Review Focus 5: trashing a link target removes the tag (A becomes an end) until undo brings it back.
test('trashing a link target removes its tag until undone', async ({ page }) => {
  const { a, door } = await twoChapters(page)
  await card(page, a).click()
  await panel(page).getByRole('button', { name: 'Link to another chapter' }).click()
  await panel(page).getByLabel('Find a node').fill('door')
  const linked = waitForSave(page, 'connections', 'POST')
  await panel(page).getByTestId('picker-results').getByRole('button').first().click()
  await linked
  await expect(card(page, a).getByTestId('cross-link')).toHaveCount(1)
  await tab(page, 'Chapter 2').click()
  await readyCanvas(page, 1)
  await card(page, door).click()
  const trashed = waitForSave(page, 'nodes', 'PATCH')
  await page.keyboard.press('Delete')
  await trashed
  await tab(page, 'Chapter 1').click()
  await readyCanvas(page, 2)
  await expect(card(page, a).getByTestId('cross-link')).toHaveCount(0)
  await expect(card(page, a).getByTestId('node-badge')).toContainText(['End'])
  const restored = waitForSave(page, 'nodes', 'PATCH')
  await page.keyboard.press(`${mod}+z`)
  await restored
  await expect(card(page, a).getByTestId('cross-link')).toHaveText('→ Chapter 2: The Door')
})
