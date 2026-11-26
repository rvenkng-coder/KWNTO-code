import { readFileSync } from 'node:fs'
import { afterAll, beforeAll, describe, expect, test } from 'vitest'
import { edgeAdminToken, edgeDown, edgeUp, raw, verifiedUser, EDGE_ADMIN_URL } from './helpers/edge.ts'

// The 67-byte PNG and the 'sampleBytes' shape are copied from tests/rules/helpers/media.ts on purpose:
// the container layer does not import from the rules layer.
const PNG_1PX = new Uint8Array(
  Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAAAAAA6fptVAAAACklEQVR4nGNgAAAAAgABSK+kcQAAAABJRU5ErkJggg==', 'base64'),
)

function sampleBytes(size: number): Uint8Array<ArrayBuffer> {
  return new Uint8Array(size)
}

const ADMIN_PASSWORD = 'test-admin-password-1'

beforeAll(() => {
  edgeDown() // left-overs of a killed earlier run
  edgeUp()
}, 300_000) // a first run builds the image and the web app

afterAll(edgeDown)

// Protects the proxy's basic job: the app's own API and sign-in work through Caddy (C1).
test('the app API works through the proxy', async () => {
  const health = await raw('/api/health')
  expect(health.status).toBe(200)
  const user = await verifiedUser()
  expect(user.token.length).toBeGreaterThan(20)
})

const BLOCKED: { method: string; path: string; body?: string }[] = [
  { method: 'GET', path: '/_/' },
  { method: 'GET', path: '/_' },
  { method: 'GET', path: '/_/images/logo.svg' },
  { method: 'POST', path: '/api/kwnto/admin/sign-out-all' },
  {
    method: 'POST',
    path: '/api/collections/_superusers/auth-with-password',
    body: JSON.stringify({ identity: 'admin@example.test', password: ADMIN_PASSWORD }),
  },
  // The superusers collection is also reachable by its id (pbc_3142635823 in PocketBase 0.40.6).
  {
    method: 'POST',
    path: '/api/collections/pbc_3142635823/auth-with-password',
    body: JSON.stringify({ identity: 'admin@example.test', password: ADMIN_PASSWORD }),
  },
  { method: 'GET', path: '/api/collections/pbc_3142635823' },
  { method: 'DELETE', path: '/api/collections/users/truncate/' },
  { method: 'GET', path: '/api/settings' },
  { method: 'GET', path: '/api/backups' },
  { method: 'GET', path: '/api/logs' },
  { method: 'GET', path: '/api/crons' },
  { method: 'GET', path: '/api/collections' },
  { method: 'GET', path: '/api/collections/users' },
  { method: 'DELETE', path: '/api/collections/users/truncate' },
  { method: 'PUT', path: '/api/collections/import' },
  { method: 'GET', path: '//_/' },
  { method: 'GET', path: '/%5F/' },
  { method: 'GET', path: '/API/settings' },
  { method: 'GET', path: '/api//settings' },
  { method: 'GET', path: '//api/collections' },
  { method: 'GET', path: '/API/COLLECTIONS/users/' },
]

// Protects security.md 6 and Review Focus 3: no admin path reaches PocketBase on the public address, under any spelling.
describe('admin paths', () => {
  // One row per spelling; a failure message names the method and path.
  test.each(BLOCKED)('every admin path is not found on the public address', async ({ method, path, body }) => {
    const res = await raw(path, {
      method,
      body,
      headers: body === undefined ? {} : { 'Content-Type': 'application/json' },
    })
    expect(res.status, `${method} ${path}`).toBe(404)
    const text = await res.text()
    expect(text, `${method} ${path}`).toBe('Not found')
    expect(text).not.toContain('token')
  })
})

// Protects security.md 5 (missing browser protections): the D3 headers on the page and the API.
test('the proxy adds the security headers', async () => {
  for (const path of ['/', '/api/health']) {
    const res = await raw(path)
    expect(res.status).toBe(200)
    expect(res.headers.get('content-security-policy')).toBe(
      "default-src 'self'; img-src 'self' blob: data:; media-src 'self' blob:; style-src 'self' 'unsafe-inline'; connect-src 'self'; frame-ancestors 'none'; base-uri 'self'; form-action 'self'",
    )
    expect(res.headers.get('x-content-type-options')).toBe('nosniff')
    expect(res.headers.get('referrer-policy')).toBe('no-referrer')
    expect(res.headers.get('x-frame-options')).toBe('DENY')
    expect(res.headers.get('permissions-policy')).toBe('camera=(), microphone=(), geolocation=()')
    expect(res.headers.get('strict-transport-security')).toBe('max-age=31536000')
    expect(res.headers.has('server')).toBe(false)
  }
})

// Protects D4 and Review Focus 5: a body over the limit is refused by the proxy before PocketBase reads it.
test('a body over the proxy limit is refused with 413', async () => {
  const post = (size: number) =>
    raw('/api/collections/media/records', {
      method: 'POST',
      headers: { 'Content-Type': 'application/octet-stream' },
      body: sampleBytes(size),
    })
  const big = await post(3 * 1024 * 1024)
  expect(big.status).toBe(413)
  expect(await big.text()).not.toContain('"message"')
  const small = await post(1024 * 1024)
  expect(small.status).not.toBe(413)
})

async function createJson(token: string, path: string, body: unknown): Promise<{ id: string }> {
  const res = await raw(path, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: token },
    body: JSON.stringify(body),
  })
  expect(res.status, await res.clone().text()).toBe(200)
  return (await res.json()) as { id: string }
}

// Protects plan 5 D6 and D3: Caddy must not replace the stricter headers PocketBase sets on stored files.
test('stored files keep their own CSP behind the proxy', async () => {
  const user = await verifiedUser()
  const team = await createJson(user.token, '/api/collections/teams/records', { name: 'Edge team', owner: user.id })
  const project = await createJson(user.token, '/api/collections/projects/records', { team: team.id, name: 'Edge project' })
  const adminToken = await edgeAdminToken()
  const chapters = await fetch(`${EDGE_ADMIN_URL}/api/collections/chapters/records?filter=${encodeURIComponent(`project="${project.id}"`)}`, {
    headers: { Authorization: adminToken },
  })
  const chapter = ((await chapters.json()) as { items: { id: string }[] }).items[0]
  const node = await createJson(user.token, '/api/collections/nodes/records', {
    project: project.id, chapter: chapter?.id, title: '', color: 'slate', x: 0, y: 0,
  })
  const form = new FormData()
  form.append('project', project.id)
  form.append('node', node.id)
  form.append('uploader', user.id)
  form.append('file', new Blob([PNG_1PX]), 'pixel.png')
  const upload = await raw('/api/collections/media/records', { method: 'POST', headers: { Authorization: user.token }, body: form })
  expect(upload.status, await upload.clone().text()).toBe(200)
  const record = (await upload.json()) as { id: string; file: string }
  const tokenRes = await raw('/api/files/token', { method: 'POST', headers: { Authorization: user.token } })
  const fileToken = ((await tokenRes.json()) as { token: string }).token
  const file = await raw(`/api/files/media/${record.id}/${record.file}?token=${fileToken}`)
  expect(file.status).toBe(200)
  expect(file.headers.get('content-security-policy')).toBe("default-src 'none'; img-src 'self'; media-src 'self'; sandbox")
  expect(file.headers.get('x-content-type-options')).toBe('nosniff')
})

// Protects design 7b (PocketBase serves the built app) and that the page can run under the D3 CSP (no inline script).
test('PocketBase serves the built web app', async () => {
  const page = await raw('/')
  expect(page.status).toBe(200)
  expect(page.headers.get('content-type')).toContain('text/html')
  const html = await page.text()
  expect(html).toContain('<div id="root">')
  expect(html).toBe(readFileSync('dist/index.html', 'utf8'))
  expect(html).not.toMatch(/<script(?![^>]*\ssrc=)[^>]*>/i)
  const asset = /(?:src|href)="(\/assets\/[^"]+\.js)"/.exec(html)?.[1]
  expect(asset).toBeDefined()
  const js = await raw(asset as string)
  expect(js.status).toBe(200)
  expect(js.headers.get('content-type')).toMatch(/javascript/)
})
