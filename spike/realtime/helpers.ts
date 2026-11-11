// THROWAWAY: shared helpers for spike.spec.ts (Task 3).
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { createServer, connect, type Socket } from 'node:net'
import { type Browser, type BrowserContext, type Page } from '@playwright/test'
import { USERS } from './seed.ts'

export const SPIKE_URL = process.env.SPIKE_URL ?? 'http://127.0.0.1:8092'
const RESULTS = join(import.meta.dirname, 'results')

export interface SpikeEvent { col: string; action: string; id: string; project: string; record: Record<string, unknown>; t: number }
export interface Client { ctx: BrowserContext; page: Page; email: string }

// Merges one measurement into results/<browser>.json (gitignored).
export function writeResult(browser: string, key: string, value: unknown) {
  mkdirSync(RESULTS, { recursive: true })
  const file = join(RESULTS, `${browser}.json`)
  let data: Record<string, unknown> = {}
  try { data = JSON.parse(readFileSync(file, 'utf8')) } catch { /* first write */ }
  data[key] = value
  writeFileSync(file, JSON.stringify(data, null, 2))
}

// Opens `count` browser contexts, each signed in as a different user and subscribed to both
// collections with filter project = "big". Events land in window.__events.
export async function openClients(browser: Browser, count = 3, urlFor: (i: number) => string = () => SPIKE_URL): Promise<Client[]> {
  const clients: Client[] = []
  for (let i = 0; i < count; i++) {
    const ctx = await browser.newContext()
    const page = await ctx.newPage()
    await page.goto(`${urlFor(i)}/api/health`)
    await page.addScriptTag({ path: 'node_modules/pocketbase/dist/pocketbase.umd.js' })
    const user = USERS[i]
    await page.evaluate(async ({ url, email, password }) => {
      const w = window as unknown as Record<string, unknown>
      const pb = new (w.PocketBase as new (u: string) => any)(url) // eslint-disable-line
      pb.autoCancellation(false)
      await pb.collection('users').authWithPassword(email, password)
      const events: unknown[] = []
      w.__pb = pb
      w.__events = events
      for (const col of ['spike_nodes', 'spike_lines']) {
        await pb.collection(col).subscribe('*', (e: any) => { // eslint-disable-line
          events.push({ col, action: e.action, id: e.record.id, project: e.record.project, record: e.record, t: Date.now() })
        }, { filter: 'project = "big"' })
      }
    }, { url: urlFor(i), email: user.email, password: user.password })
    clients.push({ ctx, page, email: user.email })
  }
  return clients
}

export const events = (c: Client) => c.page.evaluate(() => (window as unknown as { __events: SpikeEvent[] }).__events)

export async function closeAll(clients: Client[]) {
  await Promise.all(clients.map((c) => c.ctx.close()))
}

// Ids of the first `n` nodes of project `big`.
export function bigNodeIds(c: Client, n: number): Promise<string[]> {
  return c.page.evaluate(async (count) => {
    const pb = (window as any).__pb // eslint-disable-line
    const r = await pb.collection('spike_nodes').getList(1, count, { filter: 'project = "big"', sort: 'id' })
    return r.items.map((i: { id: string }) => i.id)
  }, n)
}

// A TCP proxy in front of the backend that can be cut and restored. Playwright's setOffline
// does not close an event stream that is already open, so it cannot simulate a dropped link.
export async function startProxy() {
  const target = new URL(SPIKE_URL)
  const sockets = new Set<Socket>()
  let up = true
  const server = createServer((client) => {
    if (!up) { client.destroy(); return }
    const upstream = connect(Number(target.port), target.hostname)
    for (const s of [client, upstream]) {
      sockets.add(s)
      s.on('close', () => { sockets.delete(s); client.destroy(); upstream.destroy() })
      s.on('error', () => s.destroy())
    }
    client.pipe(upstream)
    upstream.pipe(client)
  })
  await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve))
  const port = (server.address() as { port: number }).port
  return {
    url: `http://127.0.0.1:${port}`,
    cut() { up = false; for (const s of sockets) s.destroy() },
    restore() { up = true },
    close() { server.close(); for (const s of sockets) s.destroy() },
  }
}
