// Protects: offline conflicts and two tabs in the browser (offline sync plan Task 5; design 6.7, 8b;
// decision D4, D9, D12): an edit made offline that meets a teammate's change to the same thing asks
// the person (keep mine / keep theirs, also for a deleted line), the answer is kept on both pages,
// and two tabs of one browser send each waiting change once.
import { expect, test, type Page } from '@playwright/test'
import { adminPB, adminRecord } from './helpers/admin'
import { addNodeAt, card, connectNodes, openProject, ownerWithProject, readyCanvas } from './helpers/editor'
import { goOffline, goOnline, syncStatus } from './helpers/offline'
import { colourButton, dragBy, ownerAndMember, panel, rename } from './helpers/pair'
import { openTeam } from './helpers/ui'

const lineText = (page: Page) => panel(page).getByTestId('line-row').first().getByLabel('Line text')

// Protects: D4, D12: a title changed offline and by a teammate asks; Keep mine wins on both pages, also after a reload.
test('keep mine overwrites the teammate\'s change after asking', async ({ browser }) => {
  const { a, b, ctxA, ids } = await ownerAndMember(browser, 1)
  const [n1] = ids as [string]
  await goOffline(ctxA, a)
  await rename(a, n1, 'Mine')
  await rename(b, n1, 'Theirs')
  await expect.poll(async () => (await adminRecord('nodes', n1)).title).toBe('Theirs')

  await ctxA.setOffline(false)
  const dialog = a.getByRole('dialog')
  await expect(dialog).toContainText('Someone else changed this while you were offline')
  await expect(dialog).toContainText('Title')
  await expect(dialog).toContainText('Yours: Mine')
  await expect(dialog).toContainText('Theirs: Theirs')
  await dialog.getByRole('button', { name: 'Keep mine' }).click()
  await expect(dialog).toHaveCount(0)
  for (const page of [a, b]) {
    await expect(card(page, n1)).toContainText('Mine')
    await page.reload()
    await readyCanvas(page, 1)
    await expect(card(page, n1)).toContainText('Mine')
  }
})

// Protects: D4, D12: Keep theirs keeps the teammate's title, and the other field I changed offline (colour) was still sent.
test('keep theirs keeps their change and still saves my other edits', async ({ browser }) => {
  const { a, b, ctxA, ids } = await ownerAndMember(browser, 1)
  const [n1] = ids as [string]
  await goOffline(ctxA, a)
  await rename(a, n1, 'Mine')
  await colourButton(a, 'red').click()
  await rename(b, n1, 'Theirs')
  await expect.poll(async () => (await adminRecord('nodes', n1)).title).toBe('Theirs')

  await ctxA.setOffline(false)
  const dialog = a.getByRole('dialog')
  await expect(dialog).toContainText('Yours: Mine')
  await dialog.getByRole('button', { name: 'Keep theirs' }).click()
  await expect(dialog).toHaveCount(0)
  await expect.poll(async () => (await adminRecord('nodes', n1)).color).toBe('red')
  for (const page of [a, b]) {
    await expect(card(page, n1)).toContainText('Theirs')
    await card(page, n1).click()
    await expect(colourButton(page, 'red')).toHaveAttribute('aria-pressed', 'true')
  }
  expect((await adminRecord('nodes', n1)).title).toBe('Theirs')
})

// Protects: D4: a script line deleted by a teammate while I edited it offline is named in the dialog, and Keep mine brings it back with my text.
test('a line deleted by a teammate can be brought back', async ({ browser }) => {
  const { a, b, ctxA, ids } = await ownerAndMember(browser, 1)
  const [n1] = ids as [string]
  await card(a, n1).click()
  await panel(a).getByRole('button', { name: 'Add line' }).click()
  await expect(panel(a).getByTestId('line-row')).toHaveCount(1)
  await card(b, n1).click()
  await expect(panel(b).getByTestId('line-row')).toHaveCount(1)

  await goOffline(ctxA, a)
  await lineText(a).fill('Mine text')
  await lineText(a).blur()
  await expect(syncStatus(a)).toHaveText('Offline, 1 change waiting')
  await lineText(b).click()
  await b.keyboard.press('Backspace')
  await expect(panel(b).getByTestId('line-row')).toHaveCount(0)
  const lines = async () => (await (await adminPB()).collection('script_lines').getFullList({ filter: `node = "${n1}"` })).length
  await expect.poll(lines).toBe(0)

  await ctxA.setOffline(false)
  const dialog = a.getByRole('dialog')
  await expect(dialog).toContainText('Someone else deleted this script line while you were offline')
  await dialog.getByRole('button', { name: 'Keep mine' }).click()
  await expect(dialog).toHaveCount(0)
  await expect.poll(lines).toBe(1)
  for (const page of [a, b]) {
    await card(page, n1).click()
    await expect(lineText(page)).toHaveValue('Mine text')
  }
})

// Protects: review focus 4, D9: two tabs of one browser send each waiting change once, and both end showing all of them.
test('two tabs of one browser send each waiting change once', async ({ page, context }) => {
  await ownerWithProject(page, 'Story')
  await readyCanvas(page, 0)
  const n1 = await addNodeAt(page, 40, 60)
  const n2 = await addNodeAt(page, 300, 60)
  const tab2 = await context.newPage()
  await tab2.goto('/')
  await openTeam(tab2, 'Crew')
  await openProject(tab2, 'Story')
  await readyCanvas(tab2, 2)

  const sent: string[] = []
  context.on('request', (r) => {
    const m = /\/api\/collections\/(nodes|script_lines)\/records/.exec(r.url())
    if (m && ['PATCH', 'POST'].includes(r.method())) sent.push(`${r.method()} ${m[1]}`)
  })
  await goOffline(context, page)
  await rename(page, n1, 'From tab one')
  await card(tab2, n2).click()
  await colourButton(tab2, 'red').click()
  await card(page, n1).click()
  await panel(page).getByRole('button', { name: 'Add line' }).click()
  await expect(syncStatus(page)).toContainText('3 changes waiting')

  await goOnline(context, page)
  await expect(syncStatus(page)).toHaveCount(0)
  await expect(syncStatus(tab2)).toHaveCount(0)
  await expect.poll(async () => (await adminRecord('nodes', n2)).color).toBe('red')
  expect((await adminRecord('nodes', n1)).title).toBe('From tab one')
  expect(sent.sort()).toEqual(['PATCH nodes', 'PATCH nodes', 'POST script_lines'])
  for (const p of [page, tab2]) {
    await expect(card(p, n1)).toContainText('From tab one')
    await card(p, n2).click()
    await expect(colourButton(p, 'red')).toHaveAttribute('aria-pressed', 'true')
    await card(p, n1).click()
    await expect(panel(p).getByTestId('line-row')).toHaveCount(1)
  }
})

// Protects: D4: x and y are one attribute, `Position`: a node moved offline that a teammate moved meanwhile asks once, with both positions.
test('a node moved by both sides asks about its position once', async ({ browser }) => {
  const { a, b, ctxA, ids } = await ownerAndMember(browser, 1)
  const [n1] = ids as [string]
  await goOffline(ctxA, a)
  await dragBy(a, n1, 200, 0)
  await expect(syncStatus(a)).toContainText('waiting')
  await dragBy(b, n1, 0, 150)
  await expect.poll(async () => Number((await adminRecord('nodes', n1)).y)).toBeGreaterThan(100)

  await ctxA.setOffline(false)
  const dialog = a.getByRole('dialog')
  await expect(dialog).toContainText('Position')
  await expect(dialog.getByText('Position', { exact: true })).toHaveCount(1)
  await expect(dialog).toContainText('Yours:')
  await expect(dialog).toContainText('Theirs:')
  await dialog.getByRole('button', { name: 'Keep theirs' }).click()
  await expect(dialog).toHaveCount(0)
  await expect(syncStatus(a)).toHaveCount(0)
  const server = await adminRecord('nodes', n1)
  expect(Number(server.y)).toBeGreaterThan(100)
  expect(Number(server.x)).toBeLessThan(150)
})

// Protects: design 6.7, review focus 5: a choice linked offline to a node a teammate linked to from the same card meanwhile is refused by the unique pair index: it is taken back, listed as failed with the server's message, and nothing else is blocked.
test('a choice refused by the unique pair index lands in the failed list', async ({ browser }) => {
  const { a, b, ctxA, ids } = await ownerAndMember(browser, 2)
  const [n1, n2] = ids as [string, string]
  await goOffline(ctxA, a)
  await a.locator(`[data-node-id="${n1}"] [data-testid="new-choice-handle"]`).dragTo(a.locator(`[data-node-id="${n2}"] .react-flow__handle.target`))
  await expect(syncStatus(a)).toContainText('waiting')
  await connectNodes(b, n1, n2)

  await ctxA.setOffline(false)
  await expect(syncStatus(a)).toContainText('1 change could not be saved')
  await syncStatus(a).getByRole('button', { name: 'Show' }).click()
  await expect(syncStatus(a).getByRole('button', { name: 'Dismiss' })).toBeVisible()
  await expect(card(a, n1).getByTestId('choice-row')).toHaveCount(1)
  await expect(card(b, n1).getByTestId('choice-row')).toHaveCount(1)
  await syncStatus(a).getByRole('button', { name: 'Dismiss' }).click()
  await expect(syncStatus(a)).toHaveCount(0)
})
