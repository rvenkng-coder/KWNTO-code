import { execFileSync, spawnSync } from 'node:child_process'
import { existsSync } from 'node:fs'

// Helpers for the edge test stack: compose.prod.yaml plus compose.edge-test.yaml (Caddy and
// PocketBase without Tailscale). Plain fetch only; tests/container does not import pocketbase.

export const EDGE_URL = 'http://127.0.0.1:8094'
// PocketBase direct, the stand-in for the tailnet port of D5: set-up calls only, never an app request.
export const EDGE_ADMIN_URL = 'http://127.0.0.1:8095'

const COMPOSE = ['compose', '-f', 'compose.prod.yaml', '-f', 'compose.edge-test.yaml']
const ADMIN_EMAIL = 'admin@example.test'
const ADMIN_PASSWORD = 'test-admin-password-1'
const USER_PASSWORD = 'Test-password-1234'

function json(body: unknown): { headers: Record<string, string>; body: string } {
  return { headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) }
}

export async function edgeAdminToken(): Promise<string> {
  const res = await fetch(`${EDGE_ADMIN_URL}/api/collections/_superusers/auth-with-password`, {
    method: 'POST',
    ...json({ identity: ADMIN_EMAIL, password: ADMIN_PASSWORD }),
  })
  if (res.status !== 200) throw new Error(`admin sign-in failed with ${res.status}`)
  return ((await res.json()) as { token: string }).token
}

// Signs up through the public address like a visitor, verifies the account with the admin token
// (the mail link cannot be followed in a test), then signs in through the public address.
export async function verifiedUser(): Promise<{ id: string; email: string; token: string }> {
  const email = `user-${crypto.randomUUID()}@example.test`
  const created = await fetch(`${EDGE_URL}/api/collections/users/records`, {
    method: 'POST',
    ...json({ email, password: USER_PASSWORD, passwordConfirm: USER_PASSWORD }),
  })
  if (created.status !== 200) throw new Error(`sign-up failed with ${created.status}: ${await created.text()}`)
  const { id } = (await created.json()) as { id: string }
  const verify = await fetch(`${EDGE_ADMIN_URL}/api/collections/users/records/${id}`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json', Authorization: await edgeAdminToken() },
    body: JSON.stringify({ verified: true }),
  })
  if (verify.status !== 200) throw new Error(`verify failed with ${verify.status}`)
  const signedIn = await fetch(`${EDGE_URL}/api/collections/users/auth-with-password`, {
    method: 'POST',
    ...json({ identity: email, password: USER_PASSWORD }),
  })
  if (signedIn.status !== 200) throw new Error(`sign-in failed with ${signedIn.status}`)
  return { id, email, token: ((await signedIn.json()) as { token: string }).token }
}

// Builds dist/ when it is missing (the stack serves it), then starts the stack and waits until healthy.
export function edgeUp(extraEnv: Record<string, string> = {}): void {
  if (!existsSync('dist/index.html')) execFileSync('npm', ['run', 'build'], { stdio: 'inherit' })
  const env = { ...process.env, ...extraEnv }
  const up = spawnSync('docker', [...COMPOSE, 'up', '-d', '--build', '--wait'], { encoding: 'utf8', env })
  if (up.status !== 0) {
    const logs = spawnSync('docker', [...COMPOSE, 'logs', '--no-color'], { encoding: 'utf8', env })
    throw new Error(`edge stack did not start:\n${up.stderr}\n${logs.stdout}${logs.stderr}`)
  }
}

// Removes the stack and its volumes. Never throws, so it is safe in afterAll and after a killed run.
export function edgeDown(): void {
  spawnSync('docker', [...COMPOSE, 'down', '-v', '--remove-orphans'], { encoding: 'utf8' })
}

export function raw(path: string, init: RequestInit = {}): Promise<Response> {
  return fetch(EDGE_URL + path, { ...init, redirect: 'manual' })
}
