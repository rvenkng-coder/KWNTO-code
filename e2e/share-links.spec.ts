// Protects design 5 and 8b and plan 2026-11-20-sharing D8 and D9: a view link shows a project
// and its media to a person without an account, a live link follows the project while a
// snapshot only moves when it is republished, a revoked link stops at once, a comment link
// asks for a sign-in and returns to the project, and an edit link lets a non-member work in
// that one project until the link is revoked.
import { expect, test, type Browser, type Page } from '@playwright/test'
import { uniqueEmail, adminPB } from './helpers/admin'
import { card, cards, ownerWithProject } from './helpers/editor'
import { rename } from './helpers/pair'
import { syncStatus } from './helpers/offline'
import { makeLink, projectIdOf, seedStory, setTabVisible, shareDialog, signInOnLinkScreen, verifiedAccount } from './helpers/share'
import { signUpVerifyAndSignIn } from './helpers/ui'

const BAD_LINK = 'This link is not valid or was revoked.'
const SIGN_IN = 'Sign in to open this shared project.'

async function visitor(browser: Browser): Promise<Page> {
  return (await browser.newContext()).newPage()
}

// The owner's page with project Story open and a seeded story of two nodes.
async function ownerWithStory(page: Page): Promise<{ gate: string; door: string; projectId: string }> {
  await ownerWithProject(page, 'Story')
  const projectId = projectIdOf(page)
  const ids = await seedStory(projectId)
  await expect(cards(page)).toHaveCount(2)
  return { ...ids, projectId }
}

async function addLateNode(projectId: string): Promise<void> {
  const pb = await adminPB()
  const chapter = await pb.collection('chapters').getFirstListItem(pb.filter('project = {:p}', { p: projectId }))
  await pb.collection('nodes').create({ project: projectId, chapter: chapter.id, title: 'Late', color: 'red', x: 800, y: 40 })
}

// Protects design 8b: the page of a person with no account shows the project name, both nodes
// and the choice, opens a node's lines and its image, and offers nothing to change.
test('a view link shows the project and its media without an account', async ({ page, browser }) => {
  const { gate } = await ownerWithStory(page)
  const address = await makeLink(page, 'view', 'live')

  const guest = await visitor(browser)
  await guest.goto(address)
  await expect(guest.getByRole('heading', { name: 'Story' })).toBeVisible()
  await expect(cards(guest)).toHaveCount(2)
  await expect(guest.getByTestId('choice-row')).toContainText('Open it')
  await card(guest, gate).click()
  await expect(guest.getByTestId('readonly-panel')).toContainText('Who goes there?')
  await expect(guest.getByTestId('readonly-panel')).toContainText('Mara')
  const image = guest.getByTestId('share-media').first()
  await expect.poll(() => image.evaluate((img: HTMLImageElement) => img.naturalWidth)).toBe(1)
  await expect(guest.getByRole('button', { name: 'Add node' })).toHaveCount(0)
  await expect(guest.getByTestId('tool-strip')).toHaveCount(0)
  await expect(guest.locator('input, textarea')).toHaveCount(0)
})

// Protects D9: a live view shows a node made later once the tab is visible again, without a
// reload; a snapshot does not, until the owner republishes it and the page is reloaded.
test('a live link follows the project and a snapshot only when republished', async ({ page, browser }) => {
  const { projectId } = await ownerWithStory(page)
  const live = await makeLink(page, 'view', 'live')
  const snapshot = await makeLink(page, 'view', 'snapshot')
  const liveGuest = await visitor(browser)
  const snapGuest = await visitor(browser)
  await liveGuest.goto(live)
  await snapGuest.goto(snapshot)
  await expect(cards(liveGuest)).toHaveCount(2)
  await expect(cards(snapGuest)).toHaveCount(2)

  await addLateNode(projectId)
  await setTabVisible(liveGuest, false)
  await setTabVisible(liveGuest, true)
  await expect(cards(liveGuest)).toHaveCount(3)
  await snapGuest.reload()
  await expect(cards(snapGuest)).toHaveCount(2)

  await shareDialog(page).getByTestId('link-row').filter({ hasText: 'snapshot' }).getByRole('button', { name: 'Republish' }).click()
  await expect(shareDialog(page).getByRole('status')).toContainText('Republished')
  await snapGuest.reload()
  await expect(cards(snapGuest)).toHaveCount(3)
})

// Protects Review Focus 1: revoking asks in the row (never a browser dialog), then the link
// shows only the bad-link sentence.
test('a revoked link stops working at once', async ({ page, browser }) => {
  await ownerWithStory(page)
  page.on('dialog', () => { throw new Error('a browser dialog opened') })
  const address = await makeLink(page, 'view', 'live')
  const guest = await visitor(browser)
  await guest.goto(address)
  await expect(cards(guest)).toHaveCount(2)

  const row = shareDialog(page).getByTestId('link-row').first()
  await row.getByRole('button', { name: 'Revoke' }).click()
  await expect(row).toContainText('Revoke this link? Anyone using it loses access at once.')
  await row.getByRole('button', { name: 'Cancel' }).click()
  await expect(row).not.toContainText('Revoked')
  await row.getByRole('button', { name: 'Revoke' }).click()
  await row.getByRole('button', { name: 'Revoke' }).click()
  await expect(row).toContainText('Revoked')

  await guest.reload()
  await expect(guest.getByText(BAD_LINK)).toBeVisible()
  await expect(guest.getByRole('heading', { name: 'Story' })).toHaveCount(0)
  await expect(cards(guest)).toHaveCount(0)
})

// Protects security.md 3 and D8: a comment link asks for a sign-in; after signing in the same
// address shows the project.
test('a comment link asks for a sign-in and returns to the project', async ({ page, browser }) => {
  await ownerWithStory(page)
  const address = await makeLink(page, 'comment', 'live')
  const account = await verifiedAccount(uniqueEmail(), 'Reader')

  const guest = await visitor(browser)
  await guest.goto(address)
  await expect(guest.getByText(SIGN_IN)).toBeVisible()
  await guest.getByRole('button', { name: 'Sign in', exact: true }).click()
  await signInOnLinkScreen(guest, account)
  await expect(guest.getByRole('heading', { name: 'Story' })).toBeVisible()
  await expect(cards(guest)).toHaveCount(2)
})

// Protects D2 and D8: a verified person who is not on the team opens an edit link, works in
// that one project, the owner sees the change live, and the person's Teams page lists it under
// Shared with me with no team or trash controls.
test('an edit link lets a non-member edit that one project', async ({ page, browser }) => {
  const { gate } = await ownerWithStory(page)
  const address = await makeLink(page, 'edit', 'live')
  await shareDialog(page).getByRole('button', { name: 'Close' }).click()

  const holder = await visitor(browser)
  await holder.goto('/')
  await signUpVerifyAndSignIn(holder, uniqueEmail(), 'Guest')
  await holder.goto(address)
  await expect(card(holder, gate)).toBeVisible()
  await rename(holder, gate, 'Gate renamed')
  await expect(card(page, gate)).toContainText('Gate renamed')

  await holder.getByRole('button', { name: 'Back to teams' }).click()
  await expect(holder.getByTestId('shared-with-me')).toContainText('Story')
  await expect(holder.getByTestId('team-list').getByRole('button')).toHaveCount(0)
  await expect(holder.getByRole('button', { name: 'Move to trash' })).toHaveCount(0)
})

// Protects Review Focus 1: when the owner revokes an edit link while the holder has the editor
// open, the holder's next change is refused and reported, nothing reaches the owner, and the
// project leaves Shared with me.
test('revoking an edit link stops an open editor\'s saves', async ({ page, browser }) => {
  const { gate } = await ownerWithStory(page)
  const address = await makeLink(page, 'edit', 'live')
  const holder = await visitor(browser)
  await holder.goto('/')
  await signUpVerifyAndSignIn(holder, uniqueEmail(), 'Guest')
  await holder.goto(address)
  await expect(card(holder, gate)).toBeVisible()

  const row = shareDialog(page).getByTestId('link-row').first()
  await row.getByRole('button', { name: 'Revoke' }).click()
  await row.getByRole('button', { name: 'Revoke' }).click()
  await expect(row).toContainText('Revoked')

  await rename(holder, gate, 'Too late')
  await expect(syncStatus(holder)).toContainText('could not be saved')
  await expect(card(page, gate)).toContainText('Gate')
  await expect(card(page, gate)).not.toContainText('Too late')

  await holder.goto('/')
  await expect(holder.getByTestId('shared-with-me')).not.toContainText('Story')
})
