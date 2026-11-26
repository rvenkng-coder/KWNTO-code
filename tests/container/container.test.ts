import { execFileSync, spawnSync } from 'node:child_process'
import { afterAll, beforeAll, expect, test } from 'vitest'

const IMAGE = 'kwnto-pocketbase:dev'
const VOLUME = 'kwnto-container-test'
const CONTAINER = 'kwnto-container-test'

const PORT = 8093
const EMAIL = 'admin@example.test'

function docker(...args: string[]) {
  return spawnSync('docker', args, { encoding: 'utf8' })
}

// Removes left-overs of a killed earlier run, so running the tests again is always safe.
function cleanUp() {
  docker('rm', '-f', CONTAINER)
  docker('volume', 'rm', '-f', VOLUME)
}

beforeAll(() => {
  cleanUp()
  execFileSync('docker', ['build', '-t', IMAGE, 'backend'], { stdio: 'inherit' })
})

afterAll(cleanUp)

// Protects design 7c: "there is no default password". A start without credentials must stop.
test('refuses to start without admin credentials', () => {
  const run = spawnSync('docker', ['run', '--rm', IMAGE], { encoding: 'utf8' })
  expect(run.status).toBe(64)
  expect(run.stderr).toContain('KWNTO_ADMIN_EMAIL and KWNTO_ADMIN_PASSWORD must be set')
})

// Protects design 7b container hardening: non-root user.
test('runs as a non-root user', () => {
  const uid = execFileSync('docker', ['run', '--rm', '--entrypoint', 'id', IMAGE, '-u'], { encoding: 'utf8' }).trim()
  expect(uid).not.toBe('0')
})

async function waitForHealth() {
  for (let i = 0; i < 60; i++) {
    try {
      if ((await fetch(`http://127.0.0.1:${PORT}/api/health`)).ok) return
    } catch {
      // not listening yet
    }
    await new Promise((r) => setTimeout(r, 500))
  }
  throw new Error(
    `PocketBase did not become healthy: ${docker('logs', CONTAINER).stdout}${docker('logs', CONTAINER).stderr}`,
  )
}

async function startOnVolume({ password }: { password: string }) {
  const run = docker(
    'run',
    '-d',
    '--name',
    CONTAINER,
    '-v',
    `${VOLUME}:/pb/pb_data`,
    '-p',
    `127.0.0.1:${PORT}:8090`,
    '-e',
    `KWNTO_ADMIN_EMAIL=${EMAIL}`,
    '-e',
    `KWNTO_ADMIN_PASSWORD=${password}`,
    IMAGE,
  )
  expect(run.status, run.stderr).toBe(0)
  await waitForHealth()
}

function stopContainer() {
  docker('stop', CONTAINER)
  docker('rm', CONTAINER)
}

async function superuserSignInStatus(password: string) {
  const res = await fetch(`http://127.0.0.1:${PORT}/api/collections/_superusers/auth-with-password`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ identity: EMAIL, password }),
  })
  return res.status
}

// Protects design 7b: "updating a container never deletes data", and that a restart
// never overwrites a password the admin may have changed in the dashboard.
test('a restart on the same volume keeps data and the original admin password', async () => {
  await startOnVolume({ password: 'first-admin-password-1' })
  stopContainer()
  await startOnVolume({ password: 'second-admin-password-2' })
  expect(await superuserSignInStatus('first-admin-password-1')).toBe(200)
  expect(await superuserSignInStatus('second-admin-password-2')).toBe(400)
})

async function adminToken(password: string): Promise<string> {
  const res = await fetch(`http://127.0.0.1:${PORT}/api/collections/_superusers/auth-with-password`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ identity: EMAIL, password }),
  })
  expect(res.status).toBe(200)
  return ((await res.json()) as { token: string }).token
}

type BehaviorRecord = { id: string; max_failed_logins: number }

async function behaviorRecords(token: string): Promise<BehaviorRecord[]> {
  const res = await fetch(`http://127.0.0.1:${PORT}/api/collections/system_behavior/records`, {
    headers: { Authorization: token },
  })
  expect(res.status).toBe(200)
  return ((await res.json()) as { items: BehaviorRecord[] }).items
}

// Protects design 7c: "defaults never overwrite edits". A setting the admin changed
// must survive a restart, and the defaults migration must not add a second record.
test('a restart on the same volume keeps an edited setting', async () => {
  const password = 'settings-admin-password-1'
  cleanUp() // a fresh volume, independent of the restart test above
  await startOnVolume({ password })
  const token = await adminToken(password)
  const before = await behaviorRecords(token)
  expect(before).toHaveLength(1)
  const res = await fetch(`http://127.0.0.1:${PORT}/api/collections/system_behavior/records/${before[0]?.id}`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json', Authorization: token },
    body: JSON.stringify({ max_failed_logins: 7 }),
  })
  expect(res.status).toBe(200)
  stopContainer()

  await startOnVolume({ password })
  const after = await behaviorRecords(await adminToken(password))
  expect(after).toHaveLength(1)
  expect(after[0]?.max_failed_logins).toBe(7)
})

// Protects: a failing test run must fail the build, and must not leave a container behind.
test('with-pocketbase passes on the exit code and cleans up', () => {
  const run = spawnSync('node', ['scripts/with-pocketbase.ts', 'node', '-e', 'process.exit(3)'])
  expect(run.status).toBe(3)
  const left = execFileSync('docker', ['compose', '-f', 'compose.test.yaml', 'ps', '-q'], { encoding: 'utf8' }).trim()
  expect(left).toBe('')
})

// Protects production start-up: production mode without a public https URL would write wrong mail links and
// settings, so the container must refuse to start (exit 64) instead.
test('refuses production mode without a public https URL', () => {
  const run = spawnSync(
    'docker',
    [
      'run',
      '--rm',
      '-e',
      `KWNTO_ADMIN_EMAIL=${EMAIL}`,
      '-e',
      'KWNTO_ADMIN_PASSWORD=test-admin-password-1',
      '-e',
      'KWNTO_PRODUCTION=1',
      IMAGE,
    ],
    { encoding: 'utf8' },
  )
  expect(run.status).toBe(64)
  expect(run.stderr).toContain('KWNTO_PUBLIC_URL must be set when KWNTO_PRODUCTION=1')
})
