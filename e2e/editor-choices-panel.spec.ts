// Protects: the Choices section and link mode (editor cards plan, Task 3; design goal 1): a
// choice is written first and linked later, Unlink empties it and removes its line, link mode
// is cancelled by Escape or the canvas, a node with only empty choices is an End, a deleted
// choice returns in its place, and a second choice to one target is refused.
import { expect, test, type Page } from '@playwright/test'
import { addNodeAt, card, connectNodes, ownerWithProject, readyCanvas, waitForSave } from './helpers/editor'

const mod = process.platform === 'darwin' ? 'Meta' : 'Control'
const panel = (page: Page) => page.getByTestId('editor-panel')
const choices = (page: Page) => panel(page).getByTestId('panel-choice')
const rows = (page: Page, id: string) => card(page, id).getByTestId('choice-row')
const banner = (page: Page) => page.getByText('Select a target node')

/** Two nodes, `a` selected; `a` is the project's start node. */
async function twoNodes(page: Page): Promise<{ a: string; b: string }> {
  await ownerWithProject(page, 'Story')
  await readyCanvas(page, 0)
  const a = await addNodeAt(page, 40, 60)
  const b = await addNodeAt(page, 320, 60)
  await card(page, a).click()
  await expect(panel(page).getByLabel('Title', { exact: true })).toBeVisible()
  return { a, b }
}

/** Adds a choice to the selected node, types its text and waits for both saves. */
async function addChoice(page: Page, text: string): Promise<void> {
  const created = waitForSave(page, 'connections', 'POST')
  await panel(page).getByRole('button', { name: 'Add choice' }).click()
  await created
  const field = choices(page).last().getByLabel('Choice text')
  await expect(field).toBeFocused()
  const saved = waitForSave(page, 'connections', 'PATCH')
  await field.fill(text)
  await field.blur()
  await saved
}

// Protects: design goal 1: write first, link later with link mode.
test('a choice can be written first and linked later', async ({ page }) => {
  const { a, b } = await twoNodes(page)
  await addChoice(page, 'Open the door')
  await expect(choices(page).first()).toContainText('Not linked')
  await expect(rows(page, a)).toContainText('Open the door')
  await expect(page.locator('.react-flow__edge')).toHaveCount(0)

  await choices(page).first().getByRole('button', { name: 'Link', exact: true }).click()
  await expect(banner(page)).toBeVisible()
  const linked = waitForSave(page, 'connections', 'PATCH')
  await card(page, b).click()
  await linked
  await expect(banner(page)).toHaveCount(0)
  await expect(choices(page).first()).toContainText('Linked → New node')
  await expect(page.locator('.react-flow__edge')).toHaveCount(1)
})

// Protects: design goal 1: Unlink empties the target and keeps the text.
test('unlink empties a choice and removes its line', async ({ page }) => {
  const { a, b } = await twoNodes(page)
  await connectNodes(page, a, b)
  const check = async () => {
    await expect(choices(page).first()).toContainText('Not linked')
    await expect(page.locator('.react-flow__edge')).toHaveCount(0)
    await expect(rows(page, a)).toHaveCount(1)
  }
  await expect(choices(page).first()).toContainText('Linked → New node')
  const saved = waitForSave(page, 'connections', 'PATCH')
  await choices(page).first().getByRole('button', { name: 'Unlink' }).click()
  await saved
  await check()
  await page.reload()
  await readyCanvas(page, 2)
  await card(page, a).click()
  await check()
})

// Protects: design goal 1 (link mode ends with Esc or a click on empty canvas, and saves nothing then).
test('link mode is cancelled with Escape and a click on empty canvas', async ({ page }) => {
  const { a } = await twoNodes(page)
  await addChoice(page, 'Wait')
  let patches = 0
  page.on('request', (r) => {
    if (r.method() === 'PATCH') patches += 1
  })
  const link = choices(page).first().getByRole('button', { name: 'Link', exact: true })
  await link.click()
  await expect(banner(page)).toBeVisible()
  await page.keyboard.press('Escape')
  await expect(banner(page)).toHaveCount(0)
  await link.click()
  await expect(banner(page)).toBeVisible()
  await page.getByTestId('canvas').click({ position: { x: 20, y: 20 } })
  await expect(banner(page)).toHaveCount(0)
  expect(patches).toBe(0)
  await expect(rows(page, a)).toHaveCount(1)
})

// Protects: design goal 1 (markers): a start node whose only choices are empty is an End.
test('a node with only empty choices is marked End', async ({ page }) => {
  const { a } = await twoNodes(page)
  await addChoice(page, 'Wait')
  await expect(card(page, a).getByTestId('node-badge').filter({ hasText: 'End' })).toHaveCount(1)
})

// Protects: D5: a deleted choice comes back with undo, in its place in this browser (the server gives it a new
// `created`, so after a reload it joins the end; see the ledger ruling).
test('a deleted choice comes back in its place with undo', async ({ page }) => {
  const { a } = await twoNodes(page)
  for (const text of ['One', 'Two', 'Three']) await addChoice(page, text)
  const removed = waitForSave(page, 'connections', 'DELETE')
  await choices(page).nth(1).getByRole('button', { name: 'Delete' }).click()
  await removed
  await expect(rows(page, a)).toHaveCount(2)
  const restored = waitForSave(page, 'connections', 'POST')
  await page.keyboard.press(`${mod}+z`)
  await restored
  await expect(rows(page, a)).toHaveText(['One', 'Two', 'Three'])
  for (const [i, text] of ['One', 'Two', 'Three'].entries()) await expect(choices(page).nth(i).getByLabel('Choice text')).toHaveValue(text)
})

// Protects: design goal 1 and plan Review Focus 4: link mode refuses a target the node already has a choice to.
test('linking to a node that already has the choice shows the message', async ({ page }) => {
  const { a, b } = await twoNodes(page)
  await connectNodes(page, a, b)
  await addChoice(page, 'Again')
  await choices(page).last().getByRole('button', { name: 'Link', exact: true }).click()
  await card(page, b).click()
  await expect(page.getByRole('alert')).toContainText('This node already has a choice to New node.')
  await expect(choices(page).last()).toContainText('Not linked')
})
