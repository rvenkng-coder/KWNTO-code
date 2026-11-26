import { expect, test, type Browser, type Page } from '@playwright/test'
import { uniqueEmail } from './helpers/admin.ts'
import {
  addNodeAt,
  card,
  createProject,
  openProject,
  ownerWithProject,
  readyCanvas,
  waitForSave,
} from './helpers/editor.ts'
import { createTeam, enableJoinCode, joinWithCode, openTeam, signUpVerifyAndSignIn } from './helpers/ui.ts'

const panel = (page: Page) => page.getByTestId('editor-panel')
const section = (page: Page) => panel(page).getByTestId('links-section')
const items = (page: Page) => section(page).getByTestId('link-item')

async function setupNode(page: Page): Promise<string> {
  await ownerWithProject(page, 'Story')
  await readyCanvas(page, 0)
  const id = await addNodeAt(page, 40, 60)
  await card(page, id).click()
  await expect(section(page)).toBeVisible()
  return id
}

async function ownerAndMember(page: Page, browser: Browser): Promise<{ a: Page; b: Page }> {
  await page.goto('/')
  await signUpVerifyAndSignIn(page, uniqueEmail(), 'Owner')
  await createTeam(page, 'Crew')
  await openTeam(page, 'Crew')
  const code = await enableJoinCode(page)
  await createProject(page, 'Story')
  const b = await (await browser.newContext()).newPage()
  await b.goto('/')
  await signUpVerifyAndSignIn(b, uniqueEmail(), 'Member')
  await joinWithCode(b, code, 'Crew')
  await openTeam(b, 'Crew')
  await openProject(b, 'Story')
  await openProject(page, 'Story')
  await readyCanvas(page, 0)
  await readyCanvas(b, 0)
  return { a: page, b }
}

async function addLink(page: Page, title: string, address: string): Promise<void> {
  await section(page).getByLabel('Link title').fill(title)
  await section(page).getByLabel('Link address').fill(address)
  await section(page).getByRole('button', { name: 'Add link' }).click()
}

// Protects: a link is added and is safe to click: shown with its host, opens in a new tab without the opener.
test('a link is added and opens safely', async ({ page }) => {
  await setupNode(page)
  const saved = waitForSave(page, 'node_links', 'POST')
  await addLink(page, 'Trailer', 'https://example.com/video')
  await saved

  await expect(items(page)).toHaveCount(1)
  const item = items(page).first()
  await expect(item).toContainText('Trailer')
  await expect(item).toContainText('example.com')
  const anchor = item.getByRole('link', { name: /Trailer/ })
  await expect(anchor).toHaveAttribute('href', 'https://example.com/video')
  await expect(anchor).toHaveAttribute('target', '_blank')
  await expect(anchor).toHaveAttribute('rel', /noopener/)
  await expect(anchor).toHaveAttribute('rel', /noreferrer/)
  await expect(section(page).getByLabel('Link title')).toHaveValue('')
  await expect(section(page).getByLabel('Link address')).toHaveValue('')
})

// Protects: unsafe input is refused and nothing is added; a title with markup stays text.
test('unsafe addresses are refused and titles stay text', async ({ page }) => {
  await setupNode(page)
  const alert = section(page).getByRole('alert')

  await addLink(page, 'Bad', 'javascript:alert(1)')
  await expect(alert).toHaveText('Only http:// and https:// addresses are allowed.')
  await expect(items(page)).toHaveCount(0)

  await addLink(page, 'Long', 'https://a.example/' + 'x'.repeat(2000))
  await expect(alert).toHaveText('The address is longer than 2000 characters.')
  await expect(items(page)).toHaveCount(0)

  const saved = waitForSave(page, 'node_links', 'POST')
  await addLink(page, '<script>window.__x=1</script>', 'https://example.com/ok')
  await saved
  await expect(items(page)).toHaveCount(1)
  await expect(items(page).first()).toContainText('<script>window.__x=1</script>')
  expect(await page.evaluate(() => (window as unknown as { __x?: number }).__x)).toBeUndefined()
})

// Protects: links persist, belong to their node, and can be deleted.
test('links persist, belong to their node and can be deleted', async ({ page }) => {
  const a = await setupNode(page)
  const saved = waitForSave(page, 'node_links', 'POST')
  await addLink(page, 'On A', 'https://example.com/a')
  await saved

  await page.reload()
  await readyCanvas(page, 1)
  await card(page, a).click()
  await expect(items(page)).toHaveCount(1)

  const b = await addNodeAt(page, 300, 60)
  await card(page, b).click()
  await expect(section(page)).toBeVisible()
  await expect(items(page)).toHaveCount(0)

  await card(page, a).click()
  const removed = waitForSave(page, 'node_links', 'DELETE')
  await items(page).first().getByRole('button', { name: 'Delete link' }).click()
  await removed
  await expect(items(page)).toHaveCount(0)
})

// Protects: live updates: a teammate sees a link appear and go without a reload.
test('a teammate sees links appear and go without a reload', async ({ page, browser }) => {
  const { a, b } = await ownerAndMember(page, browser)
  const nodeId = await addNodeAt(a, 40, 60)
  await expect(card(b, nodeId)).toBeVisible()
  await card(a, nodeId).click()
  await card(b, nodeId).click()
  await expect(section(a)).toBeVisible()
  await expect(section(b)).toBeVisible()

  const saved = waitForSave(a, 'node_links', 'POST')
  await addLink(a, 'Live', 'https://example.com/live')
  await saved
  await expect(items(a)).toHaveCount(1)
  await expect(items(b)).toHaveCount(1)
  await expect(items(b).first()).toContainText('Live')

  await items(a).first().getByRole('button', { name: 'Delete link' }).click()
  await expect(items(a)).toHaveCount(0)
  await expect(items(b)).toHaveCount(0)
})
