// THROWAWAY: real-time measurements A to G (Task 3). Each test writes its numbers to
// results/<browser>.json; a failing threshold is a finding, so tests record before asserting.
import { expect, test } from '@playwright/test'
import { bigNodeIds, closeAll, events, openClients, SPIKE_URL, writeResult } from './helpers.ts'

// A. Protects ERD "per-attribute editing": two people editing different fields of one node
// at the same moment must both keep their change.
test('A: per-attribute merge keeps both edits', async ({ browser, browserName }) => {
  const [c1, c2, c3] = await openClients(browser)
  const ids = await bigNodeIds(c1, 20)
  let kept = 0
  const lost = { title: 0, color: 0 }
  for (let round = 0; round < 20; round++) {
    const id = ids[round]
    const title = `t-${round}`
    const color = `#00${round.toString(16).padStart(4, '0')}`
    await Promise.all([
      c1.page.evaluate(([i, v]) => (window as any).__pb.collection('spike_nodes').update(i, { title: v }), [id, title]), // eslint-disable-line
      c2.page.evaluate(([i, v]) => (window as any).__pb.collection('spike_nodes').update(i, { color: v }), [id, color]), // eslint-disable-line
    ])
    const rec = await c3.page.evaluate((i) => (window as any).__pb.collection('spike_nodes').getOne(i), id) // eslint-disable-line
    if (rec.title === title && rec.color === color) kept++
    if (rec.title !== title) lost.title++
    if (rec.color !== color) lost.color++
  }
  writeResult(browserName, 'A', { roundsBothKept: kept, rounds: 20, lostEdits: lost })
  await closeAll([c1, c2, c3])
  expect(kept).toBe(20)
})

// C. Protects the "open a large project" experience: initial load of 500 nodes and 5,000 lines.
test('C: initial load of the big project', async ({ browser, browserName }) => {
  const [c1] = await openClients(browser, 1)
  const r = await c1.page.evaluate(async () => {
    const pb = (window as any).__pb // eslint-disable-line
    const t0 = performance.now()
    const nodes = await pb.collection('spike_nodes').getFullList({ filter: 'project = "big"' })
    const lines = await pb.collection('spike_lines').getFullList({ filter: 'project = "big"' })
    return { ms: Math.round(performance.now() - t0), nodes: nodes.length, lines: lines.length }
  })
  writeResult(browserName, 'C', r)
  await closeAll([c1])
  expect(r.nodes).toBe(500)
  expect(r.lines).toBe(5000)
  expect(r.ms).toBeLessThan(3000)
})

// D. Protects project isolation: edits to project `other` must never reach `big` subscribers.
test('D: filter isolation between projects', async ({ browser, browserName }) => {
  const clients = await openClients(browser)
  const [c1] = clients
  const leaked = await c1.page.evaluate(async (url) => {
    const PB = (window as any).PocketBase // eslint-disable-line
    const su = new PB(url)
    su.autoCancellation(false)
    await su.collection('_superusers').authWithPassword('admin@example.test', 'spike-admin-password-1')
    const others = await su.collection('spike_nodes').getList(1, 10, { filter: 'project = "other"' })
    for (let i = 0; i < 50; i++) {
      await su.collection('spike_nodes').update(others.items[i % others.items.length].id, { title: `other-${i}` })
    }
    // Control: an edit in `big` must still arrive, proving the subscriptions are alive.
    const big = await su.collection('spike_nodes').getList(1, 1, { filter: 'project = "big"', sort: '-id' })
    await su.collection('spike_nodes').update(big.items[0].id, { title: 'control' })
    return big.items[0].id as string
  }, SPIKE_URL)
  await c1.page.waitForTimeout(2000)
  const result = []
  for (const c of clients) {
    const ev = await events(c)
    result.push({ otherProject: ev.filter((e) => e.project === 'other').length, controlArrived: ev.some((e) => e.id === leaked) })
  }
  writeResult(browserName, 'D', { perClient: result })
  await closeAll(clients)
  for (const r of result) {
    expect(r.otherProject).toBe(0)
    expect(r.controlArrived).toBe(true)
  }
})
