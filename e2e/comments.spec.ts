// Protects design 5 and security.md 5 (XSS): team members comment on a node and see each other's comments live, the
// owner deletes any, titles and comments with HTML show as plain text, and a comment-link holder comments until the
// link is revoked.
import { expect, test, type Page } from '@playwright/test'
import { uniqueEmail } from './helpers/admin'
import { addNodeAt, card, cards, ownerWithProject, readyCanvas } from './helpers/editor'
import { ownerAndMember, panel, rename } from './helpers/pair'
import { makeLink, projectIdOf, seedStory, shareDialog } from './helpers/share'
import { signUpVerifyAndSignIn } from './helpers/ui'

const rows = (page: Page) => page.getByTestId('comment-row')
const badge = (page: Page, id: string) => card(page, id).getByTestId('comment-badge')

async function comment(page: Page, text: string): Promise<void> {
  await panel(page).getByLabel('Add a comment').fill(text)
  await panel(page).getByRole('button', { name: 'Comment', exact: true }).click()
}

// Protects design 5: a member's comment reaches the owner's open panel with the member's name
// and a count on the card, without a reload; the owner deletes it in the row (Cancel keeps it,
// never a browser dialog) and both screens clear.
test('a comment appears for the team live and the owner can delete it', async ({ browser }) => {
  const { a, b, ids } = await ownerAndMember(browser, 1)
  const [id] = ids as [string]
  a.on('dialog', () => {
    throw new Error('a browser dialog opened')
  })
  await card(a, id).click()
  await card(b, id).click()
  await comment(b, 'Line 3 needs a pause')

  await expect(rows(a)).toHaveCount(1)
  await expect(rows(a).first()).toContainText('Member')
  await expect(rows(a).first()).toContainText('Line 3 needs a pause')
  await expect(badge(a, id)).toHaveText('1')
  await expect(badge(b, id)).toHaveText('1')

  await rows(a).first().getByRole('button', { name: 'Delete' }).click()
  await expect(rows(a).first()).toContainText('Delete this comment?')
  await rows(a).first().getByRole('button', { name: 'Cancel' }).click()
  await expect(rows(a)).toHaveCount(1)
  await rows(a).first().getByRole('button', { name: 'Delete' }).click()
  await rows(a).first().getByRole('button', { name: 'Delete' }).click()
  await expect(rows(a)).toHaveCount(0)
  await expect(rows(b)).toHaveCount(0)
  await expect(badge(a, id)).toHaveCount(0)
  await expect(badge(b, id)).toHaveCount(0)
})

// Protects security.md 5: HTML in a title or a comment is text, before and after a reload: nothing runs and no element
// is made.
test('titles and comments with HTML show as text', async ({ page }) => {
  const title = '<img src=x onerror="window.__xss=1">'
  const text = '<script>window.__xss=1</script><b>bold</b>'
  await ownerWithProject(page, 'Story')
  await readyCanvas(page, 0)
  const id = await addNodeAt(page, 40, 60)
  await rename(page, id, title)
  await comment(page, text)
  await expect(rows(page)).toHaveCount(1)

  await page.reload()
  await readyCanvas(page, 1)
  await card(page, id).click()
  await expect(card(page, id)).toContainText(title)
  await expect(rows(page).first()).toHaveText(new RegExp(text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')))
  await expect(rows(page).first().locator('b, script, img')).toHaveCount(0)
  expect(await page.evaluate(() => (window as unknown as { __xss?: number }).__xss)).toBeUndefined()
  await expect(cards(page)).toHaveCount(1)
})

// Protects: a person with a comment link comments from the viewer and the team sees it; once the link is revoked the
// next comment is refused with a message and the team never sees it.
test('a comment link holder comments until the link is revoked', async ({ page, browser }) => {
  const { gate } = await (async () => {
    await ownerWithProject(page, 'Story')
    return seedStory(projectIdOf(page))
  })()
  await expect(cards(page)).toHaveCount(2)
  const address = await makeLink(page, 'comment', 'live')
  await shareDialog(page).getByRole('button', { name: 'Close' }).click()

  const guest = await (await browser.newContext()).newPage()
  await guest.goto('/')
  await signUpVerifyAndSignIn(guest, uniqueEmail(), 'Reader')
  await guest.goto(address)
  await card(guest, gate).click()
  await guest.getByLabel('Add a comment').fill('From the link')
  await guest.getByRole('button', { name: 'Comment', exact: true }).click()
  await expect(guest.getByTestId('comment-row')).toHaveCount(1)

  await card(page, gate).click()
  await expect(rows(page)).toHaveCount(1)
  await expect(rows(page).first()).toContainText('From the link')

  await page.getByRole('button', { name: 'Share' }).click()
  const row = shareDialog(page).getByTestId('link-row').first()
  await row.getByRole('button', { name: 'Revoke' }).click()
  await row.getByRole('button', { name: 'Revoke' }).click()
  await expect(row).toContainText('Revoked')
  await shareDialog(page).getByRole('button', { name: 'Close' }).click()

  await guest.getByLabel('Add a comment').fill('Too late')
  await guest.getByRole('button', { name: 'Comment', exact: true }).click()
  // The comment section's own alert (not any alert on the page) carries a message.
  await expect(guest.getByRole('region', { name: 'Comments' }).getByRole('alert')).toHaveText(/\S/)
  await expect(rows(page)).toHaveCount(1)
})
