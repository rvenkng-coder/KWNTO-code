// Protects: choices and cues on the node card (editor cards design, goals 1 and 2):
// a choice is a row with its own connector, "+" makes a new one, a dot re-links a choice and
// keeps its id and text, a second choice to the same node is refused, and cues show on the card.
import { expect, test, type Page } from '@playwright/test'
import { addNodeAt, card, connectNodes, ownerWithProject, readyCanvas, waitForSave } from './helpers/editor'

const panel = (page: Page) => page.getByTestId('editor-panel')
const rows = (page: Page, id: string) => card(page, id).getByTestId('choice-row')
const handle = (page: Page, choiceId: string) => page.locator(`[data-handleid="choice-${choiceId}"]`)

// Protects: design goal 1: a choice made with "+" is an Untitled row whose line leaves from its own dot.
test('a choice dragged from the plus connector appears as a row with its own line', async ({ page }) => {
  await ownerWithProject(page, 'Story')
  await readyCanvas(page, 0)
  const a = await addNodeAt(page, 40, 60)
  const b = await addNodeAt(page, 320, 60)
  const choiceId = await connectNodes(page, a, b)
  await expect(rows(page, a)).toHaveCount(1)
  await expect(rows(page, a)).toContainText('Untitled')
  await expect(page.locator('.react-flow__edge')).toHaveCount(1)
  await expect(rows(page, a).locator(`[data-handleid="choice-${choiceId}"]`)).toHaveCount(1)
})

// Protects: editor cards design, goal 1: re-linking keeps the choice's id, text and place.
test("dragging a choice's dot to another node re-links it and keeps its text", async ({ page }) => {
  await ownerWithProject(page, 'Story')
  await readyCanvas(page, 0)
  const a = await addNodeAt(page, 40, 60)
  const b = await addNodeAt(page, 320, 60)
  const c = await addNodeAt(page, 320, 400)
  const choiceId = await connectNodes(page, a, b)
  await page.getByTestId(`rf__edge-${choiceId}`).click()
  const named = waitForSave(page, 'connections', 'PATCH')
  const field = panel(page).getByLabel('Choice text')
  await field.fill('Go')
  await field.blur()
  await named

  const moved = waitForSave(page, 'connections', 'PATCH')
  await handle(page, choiceId).dragTo(page.locator(`[data-node-id="${c}"] .react-flow__handle.target`))
  await moved
  const check = async () => {
    await expect(rows(page, a)).toHaveCount(1)
    await expect(rows(page, a)).toContainText('Go')
    await expect(handle(page, choiceId)).toHaveCount(1)
    await expect(page.locator('.react-flow__edge')).toHaveCount(1)
    await expect(page.getByTestId(`rf__edge-${choiceId}`)).toHaveAttribute('aria-label', `Edge from ${a} to ${c}`)
  }
  await check()
  await page.reload()
  await readyCanvas(page, 3)
  await check()
})

// Protects: editor cards design, goal 1 (one choice per target): the second drag is refused and nothing is sent.
test('a second choice to the same node is refused with a message', async ({ page }) => {
  await ownerWithProject(page, 'Story')
  await readyCanvas(page, 0)
  const a = await addNodeAt(page, 40, 60)
  const b = await addNodeAt(page, 320, 60)
  await connectNodes(page, a, b)
  let posts = 0
  page.on('request', (r) => {
    if (r.method() === 'POST' && r.url().includes('/api/collections/connections/records')) posts += 1
  })
  await page
    .locator(`[data-node-id="${a}"] [data-testid="new-choice-handle"]`)
    .dragTo(page.locator(`[data-node-id="${b}"] .react-flow__handle.target`))
  await expect(page.getByRole('alert')).toContainText('This node already has a choice to New node.')
  await expect(rows(page, a)).toHaveCount(1)
  expect(posts).toBe(0)
})

// Protects: design goal 2: a card shows two cues with their type and counts the rest.
test('cues show on the card', async ({ page }) => {
  await ownerWithProject(page, 'Story')
  await readyCanvas(page, 0)
  const a = await addNodeAt(page, 40, 60)
  await card(page, a).click()
  for (const [i, [type, text]] of [
    ['audio', 'Rain'],
    ['lighting', 'Dim'],
    ['other', 'Fog'],
  ].entries()) {
    const created = waitForSave(page, 'cues', 'POST')
    await panel(page).getByRole('button', { name: 'Add cue' }).click()
    await created
    const row = panel(page).getByTestId('cue-row').nth(i)
    const typed = waitForSave(page, 'cues', 'PATCH')
    await row.getByLabel('Cue type').selectOption(type as string)
    await typed
    const saved = waitForSave(page, 'cues', 'PATCH')
    await row.getByLabel('Cue text').fill(text as string)
    await row.getByLabel('Cue text').blur()
    await saved
  }
  const shown = card(page, a)
  for (const word of ['Audio', 'Rain', 'Light', 'Dim', '+1 more']) await expect(shown).toContainText(word)
  await expect(shown).not.toContainText('Fog')
})
