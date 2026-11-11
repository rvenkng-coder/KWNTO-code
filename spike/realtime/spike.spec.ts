// THROWAWAY: real-time measurements A to G (Task 3). Each test writes its numbers to
// results/<browser>.json; a failing threshold is a finding, so tests record before asserting.
import { expect, test } from '@playwright/test'
import { bigNodeIds, closeAll, events, openClients, SPIKE_URL, startProxy, writeResult } from './helpers.ts'

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

// B. Protects live editing for a team: 3 clients each send 5 single-field edits per second
// for 60 s; the other two must see every one quickly. Each client edits its own node, so this
// measures delivery, not merge (that is A).
test('B: fan-out latency and loss', async ({ browser, browserName }) => {
  test.setTimeout(240_000)
  const clients = await openClients(browser)
  const ids = (await bigNodeIds(clients[0], 110)).slice(100)
  const sent = await Promise.all(clients.map((c, i) => c.page.evaluate(async ([id, who]) => {
    const pb = (window as any).__pb // eslint-disable-line
    let seq = 0
    let failed = 0
    await new Promise<void>((done) => {
      const timer = setInterval(() => {
        if (seq >= 300) { clearInterval(timer); setTimeout(done, 500); return }
        const n = seq++
        pb.collection('spike_nodes').update(id, { title: `B|${who}|${n}|${Date.now()}` }).catch(() => { failed++ })
      }, 200)
    })
    return { sent: seq, failed }
  }, [ids[i], i] as const)))
  await clients[0].page.waitForTimeout(3000)

  const latencies: number[] = []
  let lost = 0
  for (let r = 0; r < clients.length; r++) {
    const seen = new Set<string>()
    for (const e of await events(clients[r])) {
      const m = /^B\|(\d)\|(\d+)\|(\d+)$/.exec(String(e.record.title))
      if (!m || Number(m[1]) === r) continue
      seen.add(`${m[1]}|${m[2]}`)
      latencies.push(e.t - Number(m[3]))
    }
    for (let s = 0; s < clients.length; s++) {
      if (s === r) continue
      for (let n = 0; n < 300; n++) if (!seen.has(`${s}|${n}`)) lost++
    }
  }
  latencies.sort((a, b) => a - b)
  const pct = (p: number) => latencies[Math.min(latencies.length - 1, Math.floor(latencies.length * p))]
  const failed = sent.reduce((a, s) => a + s.failed, 0)
  const res = { events: latencies.length, p50Ms: pct(0.5), p95Ms: pct(0.95), maxMs: latencies[latencies.length - 1], lostEvents: lost, failedWrites: failed }
  writeResult(browserName, 'B', res)
  await closeAll(clients)
  expect(res.p95Ms).toBeLessThan(500)
  expect(res.lostEvents).toBe(0)
  expect(res.failedWrites).toBe(0)
})

// E. Protects sync design (Plan 4): record what a client that was offline 10 s receives
// afterwards. Record only; the finding decides whether the client must refetch.
test('E: reconnect after 10 s offline', async ({ browser, browserName }) => {
  test.skip(!SPIKE_URL.startsWith('http://'), 'E cuts the link with a local proxy; it needs an http:// backend')
  // c2 reaches the backend through a proxy that can be cut, which really drops its event stream.
  const proxy = await startProxy()
  const clients = await openClients(browser, 2, (i) => (i === 1 ? proxy.url : SPIKE_URL))
  const [c1, c2] = clients
  const ids = (await bigNodeIds(c1, 130)).slice(120)
  proxy.cut()
  await c1.page.waitForTimeout(500)
  for (let i = 0; i < 5; i++) {
    await c1.page.evaluate(([id, n]) => (window as any).__pb.collection('spike_nodes').update(id, { title: `E|${n}|${Date.now()}` }), [ids[i], i] as const) // eslint-disable-line
  }
  await c1.page.waitForTimeout(10_000)
  const backOnline = Date.now()
  proxy.restore()
  // Keep sending probes; the first one c2 receives marks "events flow again".
  let flowMs: number | null = null
  for (let k = 0; k < 120 && flowMs === null; k++) {
    await c1.page.evaluate(([id, n]) => (window as any).__pb.collection('spike_nodes').update(id, { title: `EP|${n}|${Date.now()}` }), [ids[5], k] as const) // eslint-disable-line
    await c1.page.waitForTimeout(250)
    const ev = await events(c2)
    const probe = ev.find((e) => String(e.record.title).startsWith('EP|'))
    if (probe) flowMs = probe.t - backOnline
  }
  const ev = await events(c2)
  const edits = ev.filter((e) => /^E\|\d\|/.test(String(e.record.title)))
  // Events that reached c2 while it was supposedly offline mean the offline switch did not cut the stream.
  const duringOffline = edits.filter((e) => e.t < backOnline).length
  proxy.close()
  writeResult(browserName, 'E', {
    editsWhileOffline: 5,
    arrivedWhileOffline: duringOffline,
    arrivedAfterReconnect: edits.length - duringOffline,
    msUntilEventsFlowAgain: flowMs,
  })
  await closeAll(clients)
})

// G. Protects conflict detection (design 6.7): record how often two back-to-back writes to one
// record get the same `updated` value, i.e. whether `updated` alone can be a version.
test('G: updated timestamp resolution', async ({ browser, browserName }) => {
  const [c1] = await openClients(browser, 1)
  const [id] = (await bigNodeIds(c1, 140)).slice(139)
  const sameUpdated = await c1.page.evaluate(async (rid) => {
    const col = (window as any).__pb.collection('spike_nodes') // eslint-disable-line
    let same = 0
    for (let i = 0; i < 50; i++) {
      const a = await col.update(rid, { title: `G|${i}|a` })
      const b = await col.update(rid, { title: `G|${i}|b` })
      if (a.updated === b.updated) same++
    }
    return same
  }, id)
  writeResult(browserName, 'G', { pairs: 50, pairsWithSameUpdated: sameUpdated })
  await closeAll([c1])
})
