import { spawnSync } from 'node:child_process'
import { afterAll, beforeAll, expect, test } from 'vitest'
import { EDGE_ADMIN_URL, edgeAdminToken, edgeDown, edgeUp, raw, verifiedUser } from './helpers/edge.ts'

// Production settings behind the proxy (plan 6 D6, D7, D8; security.md 3). One edge stack
// started with KWNTO_PRODUCTION=1, so the migration writes the rate limiter and the trusted
// proxy. Wrong passwords are sent through the proxy at 127.0.0.1:8094. The auth limit is
// 2 requests per 3 s per address, so tests wait for the window between steps.

const AUTH_WINDOW_MS = 3100
const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms))

beforeAll(() => {
  edgeDown()
  edgeUp({ KWNTO_PRODUCTION: '1', KWNTO_PUBLIC_URL: 'https://kwnto.example.ts.net' })
}, 600_000)

afterAll(edgeDown)

const wrongBody = (email: string) => JSON.stringify({ identity: email, password: 'wrong-password-1' })
const rightBody = (email: string) => JSON.stringify({ identity: email, password: 'Test-password-1234' })
const SIGN_IN = '/api/collections/users/auth-with-password'

function signIn(body: string, headers: Record<string, string> = {}): Promise<Response> {
  return raw(SIGN_IN, { method: 'POST', headers: { 'Content-Type': 'application/json', ...headers }, body })
}

async function failureIps(email: string, token: string): Promise<string[]> {
  const filter = encodeURIComponent(`type = 'failure' && detail.identity = '${email}'`)
  const res = await fetch(`${EDGE_ADMIN_URL}/api/collections/security_events/records?perPage=100&filter=${filter}`, {
    headers: { Authorization: token },
  })
  expect(res.status).toBe(200)
  return ((await res.json()) as { items: { ip: string }[] }).items.map((item) => item.ip)
}

// Protects security.md 3, "parallel guesses": the lockout cannot stop guesses that arrive at once.
test('parallel wrong passwords are rate limited behind the proxy', async () => {
  const user = await verifiedUser()
  await sleep(AUTH_WINDOW_MS)
  const token = await edgeAdminToken()
  await sleep(AUTH_WINDOW_MS)
  const answers = await Promise.all(Array.from({ length: 20 }, () => signIn(wrongBody(user.email))))
  const limited = answers.filter((res) => res.status === 429).length
  expect(limited).toBeGreaterThanOrEqual(17)
  expect((await failureIps(user.email, token)).length).toBeLessThanOrEqual(3)
})

// Protects D6: a client's own X-Forwarded-For must not move the lockout, or anyone could dodge it.
test('a client cannot choose its own IP with X-Forwarded-For', async () => {
  await sleep(AUTH_WINDOW_MS)
  const user = await verifiedUser()
  await sleep(AUTH_WINDOW_MS)
  const token = await edgeAdminToken()
  for (let i = 0; i < 3; i++) {
    await sleep(AUTH_WINDOW_MS)
    expect((await signIn(wrongBody(user.email), { 'X-Forwarded-For': '203.0.113.1' })).status).toBe(400)
  }
  await sleep(AUTH_WINDOW_MS)
  expect((await signIn(rightBody(user.email), { 'X-Forwarded-For': '203.0.113.2' })).status).toBe(429)
  const ips = await failureIps(user.email, token)
  expect(ips).toHaveLength(3)
  expect(ips).not.toContain('203.0.113.1')
})

// A request from the Tailscale container's address (172.30.0.2, free in this stack) is believed.
function fromTrustedHop(body: string, forwardedFor: string): number {
  const run = spawnSync(
    'docker',
    [
      'run', '--rm', '--network', 'kwnto-edge', '--ip', '172.30.0.2', '--entrypoint', 'wget', 'kwnto-pocketbase:dev',
      '-S', '-q', '-O', '/dev/null', '--header', 'Content-Type: application/json', '--header', `X-Forwarded-For: ${forwardedFor}`,
      '--post-data', body, `http://caddy:8080${SIGN_IN}`,
    ],
    { encoding: 'utf8' },
  )
  const match = /HTTP\/\d\.\d (\d{3})/.exec(run.stderr)
  if (!match) throw new Error(`no status from wget: ${run.stderr}`)
  return Number(match[1])
}

// Protects D6: behind Tailscale the address it forwards is the one the lockout counts.
test('the address Tailscale forwards is the one the lockout counts', async () => {
  await sleep(AUTH_WINDOW_MS)
  const user = await verifiedUser()
  await sleep(AUTH_WINDOW_MS)
  const token = await edgeAdminToken()
  for (let i = 0; i < 3; i++) {
    await sleep(AUTH_WINDOW_MS)
    expect(fromTrustedHop(wrongBody(user.email), '203.0.113.1')).toBe(400)
  }
  await sleep(AUTH_WINDOW_MS)
  expect(fromTrustedHop(rightBody(user.email), '203.0.113.2')).toBe(200)
  expect(new Set(await failureIps(user.email, token))).toEqual(new Set(['203.0.113.1']))
}, 120_000)
