// Protects: the editor frame and the chapter tabs (editor core plan, Task 9): a new project opens
// with Chapter 1, chapter edits survive a reload, closing a tab differs from trashing a chapter,
// only the owner trashes a project, deleting a team names its projects, and an outsider sees nothing.
import { expect, test } from '@playwright/test'
import { uniqueEmail } from './helpers/admin'
import { createProject, ownerWithProject, tabTitles, waitForSave } from './helpers/editor'
import { enableJoinCode, joinWithCode, openTeam, signUpVerifyAndSignIn } from './helpers/ui'

const allChapters = (page: import('@playwright/test').Page) => page.getByRole('menu', { name: 'All chapters' })

// Protects: a new project opens in the editor with its first chapter and the three regions.
test('a new project opens with Chapter 1', async ({ page }) => {
  await ownerWithProject(page, 'Story')
  await expect(page.getByRole('button', { name: 'Back to teams' })).toBeVisible()
  await expect(page.getByTestId('editor-canvas')).toBeVisible()
  await expect(page.getByTestId('editor-panel')).toBeVisible()
  expect(await tabTitles(page)).toEqual(['Chapter 1'])
})

// Protects: a chapter's title and place are saved, so they are the same after a reload.
test('chapter names and order survive a reload', async ({ page }) => {
  await ownerWithProject(page, 'Story')
  const created = waitForSave(page, 'chapters', 'POST')
  await page.getByRole('button', { name: 'Add chapter' }).click()
  await created
  await expect(page.getByRole('tab', { name: 'Chapter 2' })).toBeVisible()
  await page.getByRole('tab', { name: 'Chapter 2' }).dblclick()
  const renamed = waitForSave(page, 'chapters', 'PATCH')
  await page.getByRole('textbox', { name: 'Chapter title' }).fill('The Door')
  await page.getByRole('textbox', { name: 'Chapter title' }).press('Enter')
  await renamed
  await expect(page.getByRole('tab', { name: 'The Door' })).toBeVisible()
  const moved = waitForSave(page, 'chapters', 'PATCH')
  await page.getByRole('button', { name: 'Menu for The Door' }).click()
  await page.getByRole('menuitem', { name: 'Move left' }).click()
  await moved
  expect(await tabTitles(page)).toEqual(['The Door', 'Chapter 1'])
  await page.reload()
  await expect(page.getByRole('tab', { name: 'Chapter 1' })).toBeVisible()
  expect(await tabTitles(page)).toEqual(['The Door', 'Chapter 1'])
})

// Protects: closing a tab only hides it here (the All chapters list reopens it); trashing removes the chapter for good.
test('closing a tab hides it and trashing removes the chapter', async ({ page }) => {
  await ownerWithProject(page, 'Story')
  const created = waitForSave(page, 'chapters', 'POST')
  await page.getByRole('button', { name: 'Add chapter' }).click()
  await created
  await page.getByRole('button', { name: 'Close Chapter 2' }).click()
  await expect(page.getByRole('tab', { name: 'Chapter 2' })).toHaveCount(0)
  await page.getByRole('button', { name: 'All chapters' }).click()
  await expect(allChapters(page).getByRole('menuitem', { name: 'Chapter 2' })).toHaveCount(1)
  await allChapters(page).getByRole('menuitem', { name: 'Chapter 2' }).click()
  await expect(page.getByRole('tab', { name: 'Chapter 2' })).toBeVisible()
  const trashed = waitForSave(page, 'chapters', 'PATCH')
  await page.getByRole('button', { name: 'Menu for Chapter 2' }).click()
  await page.getByRole('menuitem', { name: 'Move to trash' }).click()
  await page.getByRole('dialog').getByRole('button', { name: 'Move to trash' }).click()
  await trashed
  await page.reload()
  await expect(page.getByRole('tab', { name: 'Chapter 1' })).toBeVisible()
  await expect(page.getByRole('tab', { name: 'Chapter 2' })).toHaveCount(0)
  await page.getByRole('button', { name: 'All chapters' }).click()
  await expect(allChapters(page).getByRole('menuitem', { name: 'Chapter 1' })).toBeVisible()
  await expect(allChapters(page).getByRole('menuitem', { name: 'Chapter 2' })).toHaveCount(0)
})

// Protects: only the team owner moves a project to the trash (design 5).
test('only the owner can move a project to the trash', async ({ page, browser }) => {
  await ownerWithProject(page, 'Story')
  await page.getByRole('button', { name: 'Back to teams' }).click()
  await openTeam(page, 'Crew')
  const code = await enableJoinCode(page)
  const memberPage = await browser.newPage()
  await memberPage.goto('/')
  await signUpVerifyAndSignIn(memberPage, uniqueEmail(), 'Member')
  await joinWithCode(memberPage, code, 'Crew')
  await openTeam(memberPage, 'Crew')
  await expect(memberPage.getByTestId('project-list')).toHaveAttribute('data-loaded', 'true')
  await expect(memberPage.getByTestId('project-list')).toContainText('Story')
  await expect(memberPage.getByRole('button', { name: 'Move to trash' })).toHaveCount(0)
  await expect(page.getByTestId('project-list')).toHaveAttribute('data-loaded', 'true')
  await page.getByRole('button', { name: 'Move to trash' }).click()
  await page.getByRole('dialog').getByRole('button', { name: 'Move to trash' }).click()
  await expect(page.getByTestId('project-list')).not.toContainText('Story')
  await memberPage.close()
})

// Protects: the owner is told how many projects go with the team (decision D13).
test('deleting a team names its project count', async ({ page }) => {
  await ownerWithProject(page, 'One')
  await page.getByRole('button', { name: 'Back to teams' }).click()
  await openTeam(page, 'Crew')
  await createProject(page, 'Two')
  await page.getByRole('button', { name: 'Delete team' }).click()
  await expect(page.getByRole('dialog')).toContainText('Delete this team and its 2 projects?')
  await page.getByRole('dialog').getByRole('button', { name: 'Cancel' }).click()
})

// Protects: someone outside the team gets the not-found text and no project content.
test('an outsider sees no project content', async ({ page, browser }) => {
  await ownerWithProject(page, 'Secret')
  const hash = new URL(page.url()).hash
  const outsider = await browser.newPage()
  await outsider.goto('/')
  await signUpVerifyAndSignIn(outsider, uniqueEmail(), 'Outsider')
  await outsider.goto(`/${hash.split('/chapter/')[0]}`)
  await expect(outsider.getByText('This project does not exist or you are not a member of its team.')).toBeVisible()
  await expect(outsider.getByRole('button', { name: 'Back to teams' })).toBeVisible()
  await expect(outsider.getByText('Chapter 1')).toHaveCount(0)
  await outsider.close()
})

// Protects: dragging the right edge of a tab changes its width, and it never goes below the minimum (decision D10).
test('a tab can be resized by dragging its edge', async ({ page }) => {
  await ownerWithProject(page, 'Story')
  const tab = page.getByRole('tab', { name: 'Chapter 1' }).locator('..')
  const handle = tab.getByRole('separator', { name: 'Resize tab' })
  const before = (await tab.boundingBox())!.width
  const box = (await handle.boundingBox())!
  const y = box.y + box.height / 2
  await page.mouse.move(box.x + 1, y)
  await page.mouse.down()
  await page.mouse.move(box.x + 61, y, { steps: 5 })
  await page.mouse.up()
  await expect.poll(async () => (await tab.boundingBox())!.width).toBeGreaterThan(before + 40)
  const wide = (await tab.boundingBox())!.width
  const grip = (await handle.boundingBox())!
  await page.mouse.move(grip.x + 1, y)
  await page.mouse.down()
  await page.mouse.move(grip.x - 500, y, { steps: 5 })
  await page.mouse.up()
  await expect.poll(async () => Math.round((await tab.boundingBox())!.width)).toBe(80)
  expect(wide).toBeGreaterThan(80)
})
