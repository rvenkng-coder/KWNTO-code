// Protects: live editing by two people (editor core plan, Task 14; design 8b "two browsers
// editing the same node"; decision 0002): edits of one node by two people both survive, a
// teammate's work appears without a reload, a save that keeps conflicting is reported and
// leaves nothing half-saved, and a member removed from the team loses the project.
import { expect, test, type Browser, type Page } from '@playwright/test'
import { uniqueEmail } from './helpers/admin'
import {
  addNodeAt,
  card,
  cards,
  connectNodes,
  createProject,
  nodePosition,
  openProject,
  readyCanvas,
  waitForSave,
} from './helpers/editor'
import { createTeam, enableJoinCode, joinWithCode, openTeam, signUpVerifyAndSignIn } from './helpers/ui'

const TOO_BUSY = 'Could not save: too many people are editing this at once. Try again.'
const NOT_FOUND = 'This project does not exist or you are not a member of its team.'
const panel = (page: Page) => page.getByTestId('editor-panel')
const titleField = (page: Page) => panel(page).getByLabel('Title', { exact: true })
const isNodePatch = (method: string, url: string) =>
  method === 'PATCH' && url.includes('/api/collections/nodes/records/')

/** The owner (page `a`) and a member who joined by code (page `b`), both with project `Story` open. */
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

/** Page `a` makes a node; waits until page `b` shows it too. */
async function sharedNode(a: Page, b: Page, x: number, y: number): Promise<string> {
  const id = await addNodeAt(a, x, y)
  await expect(card(b, id)).toBeVisible()
  return id
}

/** Drags a card 200 px to the right with the mouse; resolves once the mouse is released. */
async function dragRight(page: Page, id: string): Promise<void> {
  const box = await card(page, id).boundingBox()
  if (box === null) throw new Error('card not on screen')
  await page.mouse.move(box.x + 40, box.y + 10)
  await page.mouse.down()
  await page.mouse.move(box.x + 140, box.y + 10, { steps: 10 })
  await page.mouse.move(box.x + 240, box.y + 10, { steps: 10 })
  await page.mouse.up()
}

// Protects: design 8b and Review Focus 1: a title typed in one browser and a drag of the same
// node in another, sent on the same version, both survive. B's PATCH is held until A's save has
// landed, so it always meets a 409 and only the door's re-read and retry (guardedSave) saves it.
test('two people editing one node both keep their change', async ({ page, browser }) => {
  const { a, b } = await ownerAndMember(page, browser)
  const id = await sharedNode(a, b, 40, 60)
  const start = await nodePosition(b, id)
  await card(a, id).click()
  await expect(titleField(a)).toBeVisible()
  const titleSaved = waitForSave(a, 'nodes', 'PATCH')
  let markHeld = () => undefined as void
  const held = new Promise<void>((resolve) => {
    markHeld = resolve
  })
  let heldOnce = false
  await b.route('**/api/collections/nodes/records/**', async (route) => {
    const request = route.request()
    if (!heldOnce && isNodePatch(request.method(), request.url())) {
      heldOnce = true
      markHeld()
      await titleSaved
    }
    await route.continue()
  })
  const moved = b.waitForResponse((r) => isNodePatch(r.request().method(), r.url()) && r.status() === 200)
  await dragRight(b, id)
  await held
  await titleField(a).fill('The Hall')
  await titleField(a).blur()
  // B's save ends in a 200 or, if its 409 is not retried, in the error banner.
  await Promise.all([titleSaved, Promise.race([moved, b.getByRole('alert').waitFor()])])
  await expect(b.getByRole('alert')).toHaveCount(0)

  const position = await nodePosition(b, id)
  expect(position.x - start.x).toBeGreaterThan(150)
  for (const p of [a, b]) {
    await expect(card(p, id)).toContainText('The Hall')
    await expect.poll(() => nodePosition(p, id)).toEqual(position)
  }
  for (const p of [a, b]) {
    await p.reload()
    await readyCanvas(p, 1)
    await expect(card(p, id)).toContainText('The Hall')
    expect(await nodePosition(p, id)).toEqual(position)
  }
})

// Protects: design 8b (live changes, D15): what a teammate adds, connects and trashes shows on
// the other page as it happens, with no reload.
test("a teammate's edits appear without a reload", async ({ page, browser }) => {
  const { a, b } = await ownerAndMember(page, browser)
  const first = await sharedNode(a, b, 40, 60)
  const doomed = await sharedNode(a, b, 300, 60)

  await card(b, first).click()
  const lineAdded = waitForSave(b, 'script_lines', 'POST')
  await panel(b).getByRole('button', { name: 'Add line' }).click()
  await lineAdded
  const lineSaved = waitForSave(b, 'script_lines', 'PATCH')
  await panel(b).getByTestId('line-row').first().getByLabel('Line text').fill('Hello from B.')
  await panel(b).getByTestId('line-row').first().getByLabel('Line text').blur()
  await lineSaved
  await expect(card(a, first)).toContainText('Hello from B.')

  const added = await addNodeAt(b, 40, 280)
  await expect(card(a, added)).toBeVisible()
  await connectNodes(b, first, added)
  await expect(a.locator('.react-flow__edge')).toHaveCount(1)

  await card(b, doomed).click()
  const trashed = waitForSave(b, 'nodes', 'PATCH')
  await b.keyboard.press('Delete')
  await trashed
  await expect(card(a, doomed)).toHaveCount(0)
  await expect(cards(a)).toHaveCount(2)
})

// Protects: plan Global Constraints (20 tries, then TOO_BUSY) and decision 0002's open point "the
// 409 path seen by a person": every PATCH of A's node is answered 409, so A is told, its title
// goes back, and nothing reaches B.
test('when saving keeps conflicting the person is told and nothing half-saves', async ({ page, browser }) => {
  const { a, b } = await ownerAndMember(page, browser)
  const id = await sharedNode(a, b, 40, 60)
  await card(a, id).click()
  const saved = waitForSave(a, 'nodes', 'PATCH')
  await titleField(a).fill('Old title')
  await titleField(a).blur()
  await saved
  await expect(card(b, id)).toContainText('Old title')

  let refused = 0
  await a.route('**/api/collections/nodes/records/**', async (route) => {
    if (!isNodePatch(route.request().method(), route.request().url())) return route.continue()
    refused++
    return route.fulfill({
      status: 409,
      contentType: 'application/json',
      body: JSON.stringify({ status: 409, message: 'Conflict.', data: {} }),
    })
  })
  await titleField(a).fill('New title')
  await titleField(a).blur()

  await expect(a.getByRole('alert')).toContainText(TOO_BUSY)
  expect(refused).toBe(20)
  await expect(card(a, id)).toContainText('Old title')
  await expect(titleField(a)).toHaveValue('Old title')
  await expect(card(b, id)).toContainText('Old title')
  await b.reload()
  await readyCanvas(b, 1)
  await expect(card(b, id)).toContainText('Old title')
})

// Protects: security.md (members only) and Task 9's not-found screen: once the owner removes a
// member, that member's next load of the project shows the not-found text and no content.
test('a removed member can no longer open the project', async ({ page, browser }) => {
  const { a, b } = await ownerAndMember(page, browser)
  await sharedNode(a, b, 40, 60)
  await a.getByRole('button', { name: 'Back to teams' }).click()
  await openTeam(a, 'Crew')
  await expect(a.getByTestId('member-list')).toContainText('Member (member)')
  await a.getByRole('button', { name: 'Remove' }).click()
  await expect(a.getByTestId('member-list')).not.toContainText('Member (member)')

  await b.reload()
  await expect(b.getByText(NOT_FOUND)).toBeVisible()
  await expect(b.getByTestId('editor-canvas')).toHaveCount(0)
  await expect(cards(b)).toHaveCount(0)
})
