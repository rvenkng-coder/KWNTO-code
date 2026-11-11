// THROWAWAY: follow-up to measurement A (decision 0002, option 2). A version counter on
// spike_nodes plus a server hook that rejects stale writes with 409; the client re-reads and
// retries. Protects the ERD "per-attribute editing" promise: no edit may be silently lost.
import { expect, test } from '@playwright/test'
import { bigNodeIds, closeAll, openClients, writeResult } from './helpers.ts'

// Client-side rule under test: send the version you last read; on 409, re-read and re-apply
// only your own field. Installed in each page as window.__guarded.
const GUARDED = `window.__guarded = async (id, fields) => {
  const col = window.__pb.collection('spike_nodes')
  let retries = 0
  for (let i = 0; i < 20; i++) {
    const rec = await col.getOne(id)
    try {
      await col.update(id, { ...fields, version: rec.version })
      return retries
    } catch (e) {
      if (e.status !== 409) throw e
      retries++
    }
  }
  throw new Error('gave up after 20 conflicts')
}`

test('a write based on an old version is rejected with 409', async ({ browser }) => {
  const [c1] = await openClients(browser, 1)
  const [id] = (await bigNodeIds(c1, 300)).slice(299)
  const status = await c1.page.evaluate(async (rid) => {
    const col = (window as any).__pb.collection('spike_nodes') // eslint-disable-line
    const rec = await col.getOne(rid)
    await col.update(rid, { title: 'first', version: rec.version }) // fresh: accepted
    try {
      await col.update(rid, { title: 'stale', version: rec.version }) // same base again: stale
      return 200
    } catch (e) {
      return (e as { status: number }).status
    }
  }, id)
  await closeAll([c1])
  expect(status).toBe(409)
})

// 100 rounds of two clients editing different fields of one node at once, both through the
// version guard. Every round must end with both edits stored and the version up by exactly 2.
test('A2: guarded concurrent edits keep both values in 100 of 100 rounds', async ({ browser, browserName }) => {
  const [c1, c2, c3] = await openClients(browser)
  for (const c of [c1, c2]) await c.page.evaluate(GUARDED)
  const ids = (await bigNodeIds(c1, 250)).slice(150)
  const run = Date.now() // unique values, so a value left by an earlier run cannot pass for this run's
  let kept = 0
  let versionOk = 0
  let retries = 0
  for (let round = 0; round < 100; round++) {
    const id = ids[round]
    const title = `t-${run}-${round}`
    const color = `c-${run}-${round}`
    const before = await c3.page.evaluate((i) => (window as any).__pb.collection('spike_nodes').getOne(i), id) // eslint-disable-line
    const r = await Promise.all([
      c1.page.evaluate(([i, v]) => (window as any).__guarded(i, { title: v }), [id, title]), // eslint-disable-line
      c2.page.evaluate(([i, v]) => (window as any).__guarded(i, { color: v }), [id, color]), // eslint-disable-line
    ])
    retries += r[0] + r[1]
    const rec = await c3.page.evaluate((i) => (window as any).__pb.collection('spike_nodes').getOne(i), id) // eslint-disable-line
    if (rec.title === title && rec.color === color) kept++
    if (rec.version === (before.version ?? 0) + 2) versionOk++
  }
  writeResult(browserName, 'A2', { roundsBothKept: kept, rounds: 100, versionIncrementedByTwo: versionOk, conflictRetries: retries })
  await closeAll([c1, c2, c3])
  expect(kept).toBe(100)
  expect(versionOk).toBe(100)
})
