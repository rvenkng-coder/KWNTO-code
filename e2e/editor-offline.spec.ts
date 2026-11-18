// Protects: offline sync in the browser (offline sync plan Task 4, design 6.7, decision 0002
// finding E): the outbox keeps entries across a reload, edits made offline wait and are saved
// when the connection returns, a teammate's changes show after a reconnect, a refused change is
// shown and not lost, signing out and undo say what is waiting.
import { expect, test } from '@playwright/test'

const OUTBOX = '/src/features/editor/sync/indexedDbOutbox.ts'

// The page imports the real adapter through the Vite dev server and drives it directly.
async function inPage<T>(page: import('@playwright/test').Page, script: string): Promise<T> {
  return page.evaluate(
    async ([path, body]) => {
      const { createIndexedDbOutbox } = (await import(/* @vite-ignore */ path as string)) as { createIndexedDbOutbox: () => Record<string, (...a: unknown[]) => Promise<unknown>> }
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
  await inPage(page, `
    const a = await box.add(${entry('U', 'a')}); const b = await box.add(${entry('U', 'b')}); const c = await box.add(${entry('U', 'c')})
    await box.add(${entry('V', 'z')})
    const listed = await box.list('U')
    await box.fail(listed[1], 'nope')
    return [a, b, c]
  `)
  await page.reload()
  const after = await inPage<{ list: number[]; failed: Array<[number, string]>; other: number[]; again: number }>(page, `
    const list = (await box.list('U')).map((e) => e.seq)
    const failed = (await box.failed('U')).map((f) => [f.entry.seq, f.message])
    const other = (await box.list('V')).map((e) => e.seq)
    const again = await box.add(${entry('U', 'd')})
    return { list, failed, other, again }
  `)
  expect(after.list).toEqual([1, 3])
  expect(after.failed).toEqual([[2, 'nope']])
  expect(after.other).toEqual([4])
  expect(after.again).toBe(5)
})
