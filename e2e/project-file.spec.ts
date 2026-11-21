// Protects: design 10 and 8b, security.md 5 "Bad imports": a project exported to a file and
// imported again keeps its chapters, lines and links, and a file that is not a project is
// refused with the server's reason and creates nothing.
import { expect, test, type Page } from '@playwright/test'
import { addNodeAt, card, cards, ownerWithProject, readyCanvas, waitForSave } from './helpers/editor'
import { panel } from './helpers/pair'
import { openTeam } from './helpers/ui'

const tab = (page: Page, name: string) => page.getByRole('tab', { name })

async function rename(page: Page, id: string, title: string): Promise<void> {
  await card(page, id).click()
  const saved = waitForSave(page, 'nodes', 'PATCH')
  const field = panel(page).getByLabel('Title', { exact: true })
  await field.fill(title)
  await field.blur()
  await saved
}

// Chapter 1 with "Gate" (one line, and a choice to "The Door"), Chapter 2 with "The Door".
async function storyWithCrossLink(page: Page): Promise<void> {
  await ownerWithProject(page, 'Story')
  await readyCanvas(page, 0)
  const gate = await addNodeAt(page, 40, 60)
  await rename(page, gate, 'Gate')
  const lineSaved = waitForSave(page, 'script_lines', 'POST')
  await panel(page).getByRole('button', { name: 'Add line' }).click()
  await lineSaved
  const lineText = panel(page).getByTestId('line-row').getByLabel('Line text')
  const textSaved = waitForSave(page, 'script_lines', 'PATCH')
  await lineText.fill('Who goes there?')
  await lineText.blur()
  await textSaved
  const created = waitForSave(page, 'chapters', 'POST')
  await page.getByRole('button', { name: 'Add chapter' }).click()
  await created
  await tab(page, 'Chapter 2').click()
  await readyCanvas(page, 0)
  const door = await addNodeAt(page, 60, 80)
  await rename(page, door, 'The Door')
  await tab(page, 'Chapter 1').click()
  await readyCanvas(page, 1)
  await card(page, gate).click()
  await panel(page).getByRole('button', { name: 'Link to another chapter' }).click()
  await panel(page).getByLabel('Find a node').fill('door')
  const linked = waitForSave(page, 'connections', 'POST')
  await panel(page).getByTestId('picker-results').getByRole('button').first().click()
  await linked
  await expect(card(page, gate).getByTestId('cross-link')).toHaveText('→ Chapter 2: The Door')
}

// Protects: design 8b (export then import): the downloaded file is imported on the team page
// as "<name> (imported)" and opens with both chapters, the line and the cross-chapter tag.
test('a project exported and imported again keeps its chapters, lines and links', async ({ page }, testInfo) => {
  await storyWithCrossLink(page)

  const download = page.waitForEvent('download')
  await page.getByRole('button', { name: 'Export project file' }).click()
  const file = await download
  expect(file.suggestedFilename()).toBe('Story.kwnto.json')
  const saved = testInfo.outputPath('Story.kwnto.json')
  await file.saveAs(saved)

  await page.getByRole('button', { name: 'Back to teams' }).click()
  await openTeam(page, 'Crew')
  await page.getByLabel('Import project').setInputFiles(saved)

  await expect(page.getByTestId('editor-left')).toContainText('Story (imported)')
  await expect(tab(page, 'Chapter 1')).toBeVisible()
  await expect(tab(page, 'Chapter 2')).toBeVisible()
  await readyCanvas(page, 1)
  const gate = cards(page).filter({ hasText: 'Gate' })
  await expect(gate.getByTestId('cross-link')).toHaveText('→ Chapter 2: The Door')
  await gate.click()
  await expect(panel(page).getByTestId('line-row').getByLabel('Line text')).toHaveValue('Who goes there?')
  await tab(page, 'Chapter 2').click()
  await readyCanvas(page, 1)
  await expect(cards(page).filter({ hasText: 'The Door' })).toHaveCount(1)
})

// Protects: security.md 5 "Bad imports" (C9): a .json that is not a KWNTO project shows the
// server's reason in an alert and adds no project.
test('a file that is not a project is refused with the reason', async ({ page }) => {
  await ownerWithProject(page, 'Story')
  await page.getByRole('button', { name: 'Back to teams' }).click()
  await openTeam(page, 'Crew')
  const projects = page.getByTestId('project-list')
  await expect(projects).toHaveAttribute('data-loaded', 'true')
  await expect(projects.getByRole('listitem')).toHaveCount(1)

  await page.getByLabel('Import project').setInputFiles({
    name: 'other.json',
    mimeType: 'application/json',
    buffer: Buffer.from('{"format":"other"}'),
  })
  await expect(page.getByTestId('import-project').getByRole('alert')).toHaveText(
    'This file is not a KWNTO project: format must be "kwnto-project".',
  )
  await expect(projects.getByRole('listitem')).toHaveCount(1)
  await expect(page.getByLabel('Import project')).toBeEnabled()
})
