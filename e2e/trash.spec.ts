// Protects: design 6.8 and Plan 7 Task 1: trashed nodes, chapters and projects are listed with
// the days left and come back by Restore; a node of a trashed chapter comes back with its
// chapter; only the owner sees and restores trashed projects.
import { expect, test, type Page } from '@playwright/test'
import { uniqueEmail } from './helpers/admin'
import { addNodeAt, card, ownerWithProject, readyCanvas, waitForSave } from './helpers/editor'
import { panel } from './helpers/pair'
import { enableJoinCode, joinWithCode, openTeam, signUpVerifyAndSignIn } from './helpers/ui'

const trashPanel = (page: Page) => page.getByRole('dialog', { name: 'Trash' })

async function openTrash(page: Page): Promise<void> {
  await page.getByRole('button', { name: 'All chapters' }).click()
  await page.getByRole('menuitem', { name: 'Trash' }).click()
  await expect(trashPanel(page)).toBeVisible()
}

// Protects: a trashed node is listed with 30 days left, Restore brings it back with its
// line, and it is still there after a reload.
test('a trashed node comes back from the trash with its contents', async ({ page }) => {
  await ownerWithProject(page, 'Story')
  await readyCanvas(page, 0)
  const id = await addNodeAt(page, 40, 60)
  await card(page, id).click()
  const lineSaved = waitForSave(page, 'script_lines', 'POST')
  await panel(page).getByRole('button', { name: 'Add line' }).click()
  await lineSaved
  const lineText = panel(page).getByTestId('line-row').getByLabel('Line text')
  const textSaved = waitForSave(page, 'script_lines', 'PATCH')
  await lineText.fill('Hello there.')
  await lineText.blur()
  await textSaved

  const trashed = waitForSave(page, 'nodes', 'PATCH')
  await card(page, id).click()
  await page.keyboard.press('Delete')
  await trashed
  await readyCanvas(page, 0)

  await page.reload()
  await readyCanvas(page, 0)
  await openTrash(page)
  await expect(trashPanel(page).getByRole('listitem')).toContainText('30 days left')
  const restored = waitForSave(page, 'nodes', 'PATCH')
  await trashPanel(page).getByRole('button', { name: 'Restore' }).click()
  await restored
  await expect(card(page, id)).toBeVisible()
  await expect(trashPanel(page)).toContainText('The trash is empty.')

  await page.reload()
  await readyCanvas(page, 1)
  await card(page, id).click()
  await expect(panel(page).getByTestId('line-row').getByLabel('Line text')).toHaveValue('Hello there.')
  await openTrash(page)
  await expect(trashPanel(page)).toContainText('The trash is empty.')
})

// Protects: a node of a trashed chapter has no Restore button, only the chapter's name, and
// restoring the chapter brings the node back.
test('a node comes back with its chapter', async ({ page }) => {
  await ownerWithProject(page, 'Story')
  await readyCanvas(page, 0)
  const id = await addNodeAt(page, 40, 60)
  const trashed = waitForSave(page, 'chapters', 'PATCH')
  await page.getByRole('button', { name: 'Menu for Chapter 1' }).click()
  await page.getByRole('menuitem', { name: 'Move to trash' }).click()
  await page.getByRole('dialog').getByRole('button', { name: 'Move to trash' }).click()
  await trashed

  await openTrash(page)
  const rows = trashPanel(page).getByRole('listitem')
  await expect(rows).toHaveCount(2)
  const nodeRow = rows.filter({ hasText: 'Restore the chapter Chapter 1 first.' })
  await expect(nodeRow).toHaveCount(1)
  await expect(nodeRow.getByRole('button')).toHaveCount(0)

  const restored = waitForSave(page, 'chapters', 'PATCH')
  await rows.filter({ hasText: 'Chapter: Chapter 1' }).getByRole('button', { name: 'Restore' }).click()
  await restored
  await expect(trashPanel(page)).toContainText('The trash is empty.')
  await page.getByRole('button', { name: 'Close trash' }).click()
  await expect(page.getByRole('tab', { name: 'Chapter 1' })).toBeVisible()
  await page.getByRole('tab', { name: 'Chapter 1' }).click()
  await expect(card(page, id)).toBeVisible()
})

// Protects: design 5 and 6.8: the owner sees trashed projects under the projects list and
// restores them; a member sees no Trash section.
test('only the owner sees trashed projects and restores them', async ({ page, browser }) => {
  await ownerWithProject(page, 'Story')
  await page.getByRole('button', { name: 'Back to teams' }).click()
  await openTeam(page, 'Crew')
  const code = await enableJoinCode(page)
  const memberPage = await browser.newPage()
  await memberPage.goto('/')
  await signUpVerifyAndSignIn(memberPage, uniqueEmail(), 'Member')
  await joinWithCode(memberPage, code, 'Crew')
  await openTeam(memberPage, 'Crew')
  await expect(memberPage.getByTestId('project-list')).toContainText('Story')

  await expect(page.getByTestId('project-list')).toHaveAttribute('data-loaded', 'true')
  await page.getByRole('button', { name: 'Move to trash' }).click()
  await page.getByRole('dialog').getByRole('button', { name: 'Move to trash' }).click()
  await expect(page.getByTestId('project-list')).not.toContainText('Story')
  await expect(page.getByTestId('team-trash')).toContainText('Story')
  await expect(page.getByTestId('team-trash')).toContainText('30 days left')

  await page.getByTestId('team-trash').getByRole('button', { name: 'Restore' }).click()
  await expect(page.getByTestId('project-list')).toContainText('Story')
  await expect(page.getByTestId('team-trash')).toContainText('No projects in the trash.')

  await expect(memberPage.getByTestId('team-trash')).toHaveCount(0)
  await memberPage.close()
})

// Protects: a project trash the server refuses keeps its error on screen; the list must not
// reload (and so wipe the alert) as if the trash had worked.
test('a failed project trash keeps its error message', async ({ page }) => {
  await ownerWithProject(page, 'Story')
  await page.getByRole('button', { name: 'Back to teams' }).click()
  await openTeam(page, 'Crew')
  await expect(page.getByTestId('project-list')).toHaveAttribute('data-loaded', 'true')
  await page.route('**/api/collections/projects/records/*', (route) =>
    route.request().method() === 'PATCH'
      ? route.fulfill({ status: 500, contentType: 'application/json', body: JSON.stringify({ message: 'Boom', data: {} }) })
      : route.continue())
  await page.getByRole('button', { name: 'Move to trash' }).click()
  await page.getByRole('dialog').getByRole('button', { name: 'Move to trash' }).click()
  await expect(page.getByTestId('project-list').getByRole('alert')).toBeVisible()
  // A reload of the list would remount it; give that a moment to happen, then look again.
  await page.waitForResponse((r) => r.url().includes('/api/collections/projects/records') && r.request().method() === 'GET', { timeout: 2000 }).catch(() => undefined)
  await expect(page.getByTestId('project-list').getByRole('alert')).toBeVisible()
  await expect(page.getByTestId('project-list')).toContainText('Story')
})
