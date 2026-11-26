// Protects: offline sync in the browser (design 6.7; events missed while disconnected are not
// replayed, decision 0002): the outbox keeps entries across a reload, edits made offline wait and are saved
// when the connection returns, a teammate's changes show after a reconnect, a refused change is
// shown and not lost, signing out and undo say what is waiting.
import { expect, test, type Page } from '@playwright/test'
import { adminRecord } from './helpers/admin'
import { addNodeAt, card, openProject, ownerWithProject, readyCanvas, waitForSave } from './helpers/editor'
import { goOffline, goOnline, syncStatus } from './helpers/offline'
import { colourButton, ownerAndMember, panel, rename, titleField } from './helpers/pair'
import { openTeam } from './helpers/ui'

const mod = process.platform === 'darwin' ? 'Meta' : 'Control'
/** A project with `count` nodes in a row, as its owner. */
async function projectWithNodes(page: Page, count: number): Promise<string[]> {
  await ownerWithProject(page, 'Story')
  await readyCanvas(page, 0)
  const ids: string[] = []
  for (let i = 0; i < count; i++) ids.push(await addNodeAt(page, 40 + i * 260, 60))
  return ids
}

const OUTBOX = '/src/features/editor/sync/indexedDbOutbox.ts'

// The page imports the real adapter through the Vite dev server and drives it directly.
async function inPage<T>(page: import('@playwright/test').Page, script: string): Promise<T> {
  return page.evaluate(
    async ([path, body]) => {
      const { createIndexedDbOutbox } = (await import(/* @vite-ignore */ path as string)) as {
        createIndexedDbOutbox: () => Record<string, (...a: unknown[]) => Promise<unknown>>
      }
      const box = createIndexedDbOutbox()
      return new Function('box', `return (async () => { ${body as string} })()`)(box) as Promise<unknown>
    },
    [OUTBOX, script],
  ) as Promise<T>
}

const entry = (userId: string, id: string) =>
  `{ userId: '${userId}', projectId: 'p1', op: 'create', kind: 'nodes', id: '${id}', record: { id: '${id}' }, offline: false, made: 1 }`

// Protects: the outbox survives a reload: entries per user in order, a failed entry kept with its message, another user's entry apart.
test('the browser outbox keeps entries across a reload', async ({ page }) => {
  await page.goto('/')
  await inPage(
    page,
    `
    const a = await box.add(${entry('U', 'a')}); const b = await box.add(${entry('U', 'b')}); const c = await box.add(${entry('U', 'c')})
    await box.add(${entry('V', 'z')})
    const listed = await box.list('U')
    const { fail } = box
    await fail(listed[1], 'nope')
    return [a, b, c]
  `,
  )
  await page.reload()
  const after = await inPage<{ list: number[]; failed: Array<[number, string]>; other: number[]; again: number }>(
    page,
    `
    const list = (await box.list('U')).map((e) => e.seq)
    const failed = (await box.failed('U')).map((f) => [f.entry.seq, f.message])
    const other = (await box.list('V')).map((e) => e.seq)
    const again = await box.add(${entry('U', 'd')})
    return { list, failed, other, again }
  `,
  )
  expect(after.list).toEqual([1, 3])
  expect(after.failed).toEqual([[2, 'nope']])
  expect(after.other).toEqual([4])
  expect(after.again).toBe(5)
})

// Protects: design 6.7: edits made offline wait in the outbox (counted in the status), nothing reaches the server, and all of them are saved when the connection returns.
test('edits made offline are saved when the connection returns', async ({ page, context }) => {
  const [a, b, c] = (await projectWithNodes(page, 3)) as [string, string, string]
  await goOffline(context, page)
  await rename(page, a, 'First')
  await card(page, b).click()
  await colourButton(page, 'red').click()
  await card(page, c).click()
  await panel(page).getByRole('button', { name: 'Add line' }).click()
  await expect(syncStatus(page)).toHaveText('Offline, 3 changes waiting')
  expect((await adminRecord('nodes', a)).title).toBe('New node')
  expect((await adminRecord('nodes', b)).color).toBe('blue')

  await goOnline(context, page)
  await expect(syncStatus(page)).toHaveCount(0)
  expect((await adminRecord('nodes', a)).title).toBe('First')
  expect((await adminRecord('nodes', b)).color).toBe('red')
  await page.reload()
  await readyCanvas(page, 3)
  await expect(card(page, a)).toContainText('First')
  await card(page, b).click()
  await expect(colourButton(page, 'red')).toHaveAttribute('aria-pressed', 'true')
  await card(page, c).click()
  await expect(panel(page).getByTestId('line-row')).toHaveCount(1)
})

// Protects: text typed just before closing an offline tab reaches IndexedDB and is sent from the next page.
test('text typed just before closing an offline tab is not lost', async ({ page, context }) => {
  const [id] = (await projectWithNodes(page, 1)) as [string]
  await card(page, id).click()
  await goOffline(context, page)
  await titleField(page).fill('Typed in a hurry')
  await page.close({ runBeforeUnload: true })
  expect((await adminRecord('nodes', id)).title).toBe('New node')

  await context.setOffline(false)
  const next = await context.newPage()
  await next.goto('/')
  await openTeam(next, 'Crew')
  await openProject(next, 'Story')
  await expect(card(next, id)).toContainText('Typed in a hurry')
  await expect.poll(async () => (await adminRecord('nodes', id)).title).toBe('Typed in a hurry')
})

// Protects: after reconnecting, a teammate's changes made meanwhile appear and my waiting edits still show on top.
test("after reconnecting a teammate's changes show and mine are kept", async ({ browser }) => {
  const { a, b, ctxA, ids } = await ownerAndMember(browser, 2)
  const [n1, n2] = ids as [string, string]
  await goOffline(ctxA, a)
  await rename(b, n1, 'Their title')
  await card(b, n2).click()
  await panel(b).getByRole('button', { name: 'Add line' }).click()
  await expect(panel(b).getByTestId('line-row')).toHaveCount(1)
  await card(a, n1).click()
  await colourButton(a, 'red').click()
  await expect(syncStatus(a)).toHaveText('Offline, 1 change waiting')

  await goOnline(ctxA, a)
  await expect(card(a, n1)).toContainText('Their title')
  await card(a, n1).click()
  await expect(colourButton(a, 'red')).toHaveAttribute('aria-pressed', 'true')
  await card(a, n2).click()
  await expect(panel(a).getByTestId('line-row')).toHaveCount(1)
  await card(b, n1).click()
  await expect(colourButton(b, 'red')).toHaveAttribute('aria-pressed', 'true')
  await expect(syncStatus(a)).toHaveCount(0)
})

// Protects: a refused change is shown with the server's message and rolled back, the next change still saves, and
// Dismiss clears the list.
test('a refused change goes to the failed list and later changes still save', async ({ page }) => {
  const [a, b] = (await projectWithNodes(page, 2)) as [string, string]
  let refused = false
  await page.route('**/api/collections/nodes/records/*', async (route) => {
    if (!refused && route.request().method() === 'PATCH') {
      refused = true
      await route.fulfill({
        status: 403,
        contentType: 'application/json',
        body: JSON.stringify({ message: 'Not allowed.' }),
      })
    } else {
      await route.continue()
    }
  })
  await rename(page, a, 'Refused')
  await expect(syncStatus(page)).toContainText('1 change could not be saved')
  await expect(card(page, a)).toContainText('New node')
  const saved = waitForSave(page, 'nodes', 'PATCH')
  await rename(page, b, 'Accepted')
  await saved
  await syncStatus(page).getByRole('button', { name: 'Show' }).click()
  await expect(syncStatus(page)).toContainText('Not allowed.')
  await syncStatus(page).getByRole('button', { name: 'Dismiss' }).click()
  await expect(syncStatus(page)).toHaveCount(0)
  expect((await adminRecord('nodes', b)).title).toBe('Accepted')
  expect((await adminRecord('nodes', a)).title).toBe('New node')
})

// Protects: signing out with waiting changes asks in the page (no browser pop-up), and Stay signed in keeps the
// session.
test('signing out with waiting changes asks first', async ({ page, context }) => {
  const [id] = (await projectWithNodes(page, 1)) as [string]
  page.on('dialog', () => {
    throw new Error('a browser dialog opened')
  })
  await goOffline(context, page)
  await rename(page, id, 'Waiting')
  await expect(syncStatus(page)).toHaveText('Offline, 1 change waiting')
  await page.getByTestId('session-user').click()
  await page.getByRole('button', { name: 'Sign out' }).click()
  await expect(page.getByRole('alertdialog')).toContainText(
    '1 change has not been saved yet. It will be saved the next time you sign in on this browser. Sign out anyway?',
  )
  await page.getByRole('button', { name: 'Stay signed in' }).click()
  await expect(page.getByRole('alertdialog')).toHaveCount(0)
  await expect(page.getByTestId('session-user')).toBeVisible()
})

// Protects: undo waits for every write in flight, which offline would never end, so it is paused while offline changes
// wait, and works once they are saved.
test('undo works again once offline changes are saved', async ({ page, context }) => {
  const [id] = (await projectWithNodes(page, 1)) as [string]
  await goOffline(context, page)
  await rename(page, id, 'Changed')
  await page.keyboard.press(`${mod}+z`)
  await expect(page.getByRole('alert')).toContainText(
    'Undo waits until you are back online and your changes are saved.',
  )
  await expect(card(page, id)).toContainText('Changed')
  await goOnline(context, page)
  await expect(syncStatus(page)).toHaveCount(0)
  await page.getByRole('button', { name: 'Dismiss' }).click()
  const saved = waitForSave(page, 'nodes', 'PATCH')
  await page.keyboard.press(`${mod}+z`)
  await saved
  await expect(card(page, id)).toContainText('New node')
})

// Protects: a node renamed offline that a teammate renamed meanwhile asks the person, shows both titles, and keeps the
// choice.
test('a title changed by both sides asks which to keep', async ({ browser }) => {
  const { a, b, ctxA, ids } = await ownerAndMember(browser, 1)
  const [n1] = ids as [string]
  await goOffline(ctxA, a)
  await rename(a, n1, 'Mine')
  await rename(b, n1, 'Theirs')
  await expect.poll(async () => (await adminRecord('nodes', n1)).title).toBe('Theirs')

  await ctxA.setOffline(false)
  const dialog = a.getByRole('dialog')
  await expect(dialog).toContainText('Someone else changed this while you were offline')
  await expect(dialog).toContainText('Yours: Mine')
  await expect(dialog).toContainText('Theirs: Theirs')
  await dialog.getByRole('button', { name: 'Keep mine' }).click()
  await expect(dialog).toHaveCount(0)
  await expect.poll(async () => (await adminRecord('nodes', n1)).title).toBe('Mine')
  await expect(card(b, n1)).toContainText('Mine')
  await expect(syncStatus(a)).toHaveCount(0)
})

// Protects: design 6.7: a stopped backend (a proxy answering 502) is offline, not a refusal: the edit stays on screen and waits, then saves when the server is back.
test('a stopped backend keeps the edit waiting and saves it when the server returns', async ({ page }) => {
  const [id] = (await projectWithNodes(page, 1)) as [string]
  const down = '**/api/collections/nodes/records/*'
  await page.route(down, (route) => route.fulfill({ status: 502, contentType: 'text/plain', body: 'Bad Gateway' }))
  await rename(page, id, 'While down')
  await expect(syncStatus(page)).toContainText('Offline, 1 change waiting')
  await expect(syncStatus(page)).not.toContainText('could not be saved')
  await expect(card(page, id)).toContainText('While down')
  expect((await adminRecord('nodes', id)).title).toBe('New node')

  await page.unroute(down)
  await expect(syncStatus(page)).toHaveCount(0, { timeout: 15_000 })
  expect((await adminRecord('nodes', id)).title).toBe('While down')
})

// Protects: design 6.7: a script line added offline survives the reconnect on the screen that made it, next to a
// teammate's recolour of the node.
test("a line added offline stays on screen after reconnecting next to a teammate's recolour", async ({ browser }) => {
  const { a, b, ids } = await ownerAndMember(browser, 1)
  const [n1] = ids as [string]
  const ctxB = b.context()
  await card(b, n1).click()
  await goOffline(ctxB, b)
  await panel(b).getByRole('button', { name: 'Add line' }).click()
  await panel(b).getByTestId('line-row').first().getByLabel('Line text').fill('content')
  await panel(b).getByTestId('line-row').first().getByLabel('Line text').blur()
  await card(a, n1).click()
  await colourButton(a, 'red').click()
  await expect.poll(async () => (await adminRecord('nodes', n1)).color).toBe('red')

  await goOnline(ctxB, b)
  await expect(syncStatus(b)).toHaveCount(0)
  await expect(panel(b).getByTestId('line-row')).toHaveCount(1)
  await expect(panel(b).getByTestId('line-row').first().getByLabel('Line text')).toHaveValue('content')
  await expect(colourButton(b, 'red')).toHaveAttribute('aria-pressed', 'true')
  await card(a, n1).click()
  await expect(panel(a).getByTestId('line-row').first().getByLabel('Line text')).toHaveValue('content')
})
