// Protects plan 2026-11-20-sharing Task 8 (case C1, the Flow): the whole plan walked once, end to end,
// in Chromium and Firefox. An owner, a member, an outsider and a visitor without an account share one
// project: export and import, the four kinds of link, comments, presence, revoking every link, and the
// trash. Each step uses the screens a person uses; only the seed story (two chapters, a cross-chapter
// choice, an image) is made through the admin API.
import { expect, test, type Page } from '@playwright/test'
import { adminPB, uniqueEmail } from './helpers/admin'
import { card, cards, readyCanvas, waitForSave } from './helpers/editor'
import { ownerAndMember, rename, titleField } from './helpers/pair'
import { makeLink, projectIdOf, seedStory, shareDialog, signInOnLinkScreen, verifiedAccount } from './helpers/share'
import { createTeam, openTeam } from './helpers/ui'

const BAD_LINK = 'This link is not valid or was revoked.'
const rows = (page: Page) => page.getByTestId('comment-row')
const trashPanel = (page: Page) => page.getByRole('dialog', { name: 'Trash' })

// Chapter 1: Gate (a line, an image, a choice to Door) and Door; Chapter 2: Far, with a choice from Gate to it.
async function seedTwoChapters(projectId: string): Promise<{ gate: string; door: string; far: string }> {
  const { gate, door } = await seedStory(projectId)
  const pb = await adminPB()
  const opts = { requestKey: null }
  const chapter = await pb.collection('chapters').create({ project: projectId, title: 'Chapter 2', position: 2 }, opts)
  const far = await pb
    .collection('nodes')
    .create({ project: projectId, chapter: chapter.id, title: 'Far', color: 'red', x: 60, y: 80 }, opts)
  await pb
    .collection('connections')
    .create({ project: projectId, from_node: gate, to_node: far.id, label: 'Go far' }, opts)
  return { gate, door, far: far.id }
}

// Revoked links are listed after the live ones, so the first row is always the next live link.
async function revokeFirst(page: Page, alreadyRevoked: number): Promise<void> {
  const rows = shareDialog(page).getByTestId('link-row')
  await rows.first().getByRole('button', { name: 'Revoke' }).click()
  await rows.first().getByRole('button', { name: 'Revoke' }).click()
  await expect(rows.filter({ hasText: 'Revoked' })).toHaveCount(alreadyRevoked + 1)
}

// Protects: Task 8 case C2 (the Flow), see the file header; one test so the people and their links carry through every step.
test('the sharing plan end to end: export, links, comments, presence, revoke and trash', async ({
  browser,
}, testInfo) => {
  testInfo.setTimeout(300_000)
  const { a: owner, b: member } = await ownerAndMember(browser, 0)
  const projectId = projectIdOf(owner)
  const { gate, door, far } = await seedTwoChapters(projectId)
  await owner.reload()
  await readyCanvas(owner, 2)
  await member.reload()
  await readyCanvas(member, 2)

  // 1. Export the project and import it into a second team.
  const download = owner.waitForEvent('download')
  await owner.getByRole('button', { name: 'Export project file' }).click()
  const file = testInfo.outputPath('Story.kwnto.json')
  await (await download).saveAs(file)
  await owner.getByRole('button', { name: 'Back to teams' }).click()
  await createTeam(owner, 'Second')
  await openTeam(owner, 'Second')
  await owner.getByLabel('Choose project file').setInputFiles(file)
  await expect(owner.getByRole('banner')).toContainText('Story (imported)')
  await expect(owner.getByRole('tab', { name: 'Chapter 2' })).toBeVisible()
  await owner.getByRole('tab', { name: 'Chapter 1' }).click()
  await readyCanvas(owner, 2)
  await owner.getByRole('button', { name: 'Back to teams' }).click()
  await openTeam(owner, 'Crew')
  await owner.getByTestId('project-list').getByRole('button', { name: 'Story', exact: true }).click()
  await owner.getByRole('tab', { name: 'Chapter 1' }).click()
  await readyCanvas(owner, 2)

  // 2. Four links: live view, snapshot, comment and edit.
  const view = await makeLink(owner, 'view', 'live')
  const snapshot = await makeLink(owner, 'view', 'snapshot')
  const commentLink = await makeLink(owner, 'comment', 'live')
  const editLink = await makeLink(owner, 'edit', 'live')
  await expect(shareDialog(owner).getByTestId('link-row')).toHaveCount(4)
  await shareDialog(owner).getByRole('button', { name: 'Close' }).click()

  // 3. A visitor without an account opens the view and snapshot links; the image is shown.
  const visitorContext = await browser.newContext()
  for (const address of [view, snapshot]) {
    const visitor = await visitorContext.newPage()
    await visitor.goto(address)
    await expect(visitor.getByRole('heading', { name: 'Story' })).toBeVisible()
    await expect(cards(visitor)).toHaveCount(2)
    await card(visitor, gate).click()
    await expect(visitor.getByTestId('readonly-panel')).toContainText('Who goes there?')
    await expect
      .poll(() =>
        visitor
          .getByTestId('share-media')
          .first()
          .evaluate((img: HTMLImageElement) => img.naturalWidth),
      )
      .toBe(1)
    await visitor.close()
  }
  const visitorView = await visitorContext.newPage()
  await visitorView.goto(view)
  await expect(cards(visitorView)).toHaveCount(2)
  const visitorSnapshot = await visitorContext.newPage()
  await visitorSnapshot.goto(snapshot)
  await expect(cards(visitorSnapshot)).toHaveCount(2)

  // 4. An outsider opens the comment link (signs in, comments), then the edit link (edits; the owner sees it live and the presence badge).
  const account = await verifiedAccount(uniqueEmail(), 'Outsider')
  const outsider = await (await browser.newContext()).newPage()
  await outsider.goto(commentLink)
  await outsider.getByRole('button', { name: 'Sign in', exact: true }).click()
  await signInOnLinkScreen(outsider, account)
  await expect(outsider.getByRole('heading', { name: 'Story' })).toBeVisible()
  await card(outsider, gate).click()
  await outsider.getByLabel('Add a comment').fill('Seen through a link')
  await outsider.getByRole('button', { name: 'Comment', exact: true }).click()
  await card(owner, gate).click()
  await expect(rows(owner)).toContainText('Seen through a link')

  await outsider.goto(editLink)
  await expect(card(outsider, gate)).toBeVisible()
  await rename(outsider, gate, 'Gate by outsider')
  await expect(card(owner, gate)).toContainText('Gate by outsider', { timeout: 10_000 })
  await card(outsider, gate).click()
  await titleField(outsider).focus()
  await expect(card(owner, gate).getByTestId('editing-badge')).toHaveText('Outsider is editing', { timeout: 15_000 })
  await outsider.evaluate(() => (document.activeElement as HTMLElement).blur())

  // 5. The member comments and deletes their own comment.
  await card(member, gate).click()
  await member.getByLabel('Add a comment').fill('Member note')
  await member.getByRole('button', { name: 'Comment', exact: true }).click()
  const mine = rows(member).filter({ hasText: 'Member note' })
  await expect(mine).toHaveCount(1)
  await mine.getByRole('button', { name: 'Delete' }).click()
  await mine.getByRole('button', { name: 'Delete' }).click()
  await expect(rows(member).filter({ hasText: 'Member note' })).toHaveCount(0)

  // 6. The owner revokes every link; each holder's next action is refused.
  await owner.getByRole('button', { name: 'Share' }).click()
  for (let i = 0; i < 4; i++) await revokeFirst(owner, i)
  await shareDialog(owner).getByRole('button', { name: 'Close' }).click()
  await visitorView.reload()
  await expect(visitorView.getByText(BAD_LINK)).toBeVisible()
  await visitorSnapshot.reload()
  await expect(visitorSnapshot.getByText(BAD_LINK)).toBeVisible()
  await outsider.getByLabel('Title', { exact: true }).fill('Too late')
  await outsider.getByLabel('Title', { exact: true }).blur()
  await expect(outsider.getByTestId('sync-status')).toContainText('could not be saved')
  await expect(card(owner, gate)).not.toContainText('Too late')
  await outsider.goto(commentLink)
  await expect(outsider.getByText(BAD_LINK)).toBeVisible()

  // 7. The member trashes a node and a chapter and restores them.
  await member.reload()
  await readyCanvas(member, 2)
  const nodeTrashed = waitForSave(member, 'nodes', 'PATCH')
  await card(member, door).click()
  await member.keyboard.press('Delete')
  await nodeTrashed
  await readyCanvas(member, 1)
  const chapterTrashed = waitForSave(member, 'chapters', 'PATCH')
  await member.getByRole('button', { name: 'Menu for Chapter 2' }).click()
  await member.getByRole('menuitem', { name: 'Move to trash' }).click()
  await member.getByRole('dialog').getByRole('button', { name: 'Move to trash' }).click()
  await chapterTrashed
  await member.getByRole('button', { name: 'All chapters' }).click()
  await member.getByRole('menuitem', { name: 'Trash' }).click()
  const restoreRows = trashPanel(member).getByRole('listitem')
  const chapterRestored = waitForSave(member, 'chapters', 'PATCH')
  await restoreRows.filter({ hasText: 'Chapter: Chapter 2' }).getByRole('button', { name: 'Restore' }).click()
  await chapterRestored
  const nodeRestored = waitForSave(member, 'nodes', 'PATCH')
  await restoreRows.filter({ hasText: 'Door' }).getByRole('button', { name: 'Restore' }).click()
  await nodeRestored
  await expect(trashPanel(member)).toContainText('The trash is empty.')
  await member.getByRole('button', { name: 'Close trash' }).click()
  await expect(member.getByRole('tab', { name: 'Chapter 2' })).toBeVisible()
  await member.getByRole('tab', { name: 'Chapter 1' }).click()
  await expect(card(member, door)).toBeVisible()
  expect(far).not.toBe('')

  // 8. The owner trashes the project and restores it.
  await owner.getByRole('button', { name: 'Back to teams' }).click()
  await openTeam(owner, 'Crew')
  await expect(owner.getByTestId('project-list')).toHaveAttribute('data-loaded', 'true')
  await owner.getByRole('button', { name: 'Move to trash' }).first().click()
  await owner.getByRole('dialog').getByRole('button', { name: 'Move to trash' }).click()
  await expect(owner.getByTestId('team-trash')).toContainText('Story')
  await owner.getByTestId('team-trash').getByRole('button', { name: 'Restore' }).click()
  await expect(owner.getByTestId('project-list')).toContainText('Story')
})
