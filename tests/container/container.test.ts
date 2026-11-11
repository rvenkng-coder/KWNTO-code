import { execFileSync, spawnSync } from 'node:child_process'
import { afterAll, beforeAll, expect, test } from 'vitest'

const IMAGE = 'kwnto-pocketbase:dev'
const VOLUME = 'kwnto-container-test'
const CONTAINER = 'kwnto-container-test'

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
