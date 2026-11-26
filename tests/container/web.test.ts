import { spawnSync } from 'node:child_process'
import { afterAll, beforeAll, expect, test } from 'vitest'

// The real `web` one-shot service of compose.prod.yaml, run once as on the VM: no override, so the
// production command (npm ci, build, copy into the volume) is what is tested. A project name of its own, so only
// its own volume and network are touched. Slow: it installs the dependencies inside the container.

const PROJECT = 'kwnto-web-test'
const COMPOSE = ['compose', '-p', PROJECT, '-f', 'compose.prod.yaml']

function cleanup(): void {
  spawnSync('docker', ['volume', 'rm', '-f', `${PROJECT}_kwnto-web`], { encoding: 'utf8' })
  spawnSync('docker', ['network', 'rm', `${PROJECT}_default`], { encoding: 'utf8' })
}

beforeAll(cleanup)
afterAll(cleanup)

// Protects the first start: on a real VM the web service must finish successfully (no git in the image, so no install
// scripts) and leave the built app in the volume, or pocketbase, caddy and tailscale never start.
test('the web service builds the app into its volume and exits 0', () => {
  const run = spawnSync('docker', [...COMPOSE, 'run', '--rm', 'web'], { encoding: 'utf8', maxBuffer: 64 * 1024 * 1024 })
  expect(run.status, `${run.stdout}\n${run.stderr}`).toBe(0)
  const check = spawnSync(
    'docker',
    [
      ...COMPOSE,
      'run',
      '--rm',
      '--no-deps',
      '--entrypoint',
      'sh',
      'web',
      '-c',
      'test -s /out/index.html && ls /out/assets | head -n 1',
    ],
    { encoding: 'utf8' },
  )
  expect(check.status, check.stderr).toBe(0)
}, 600_000)

// Protects security.md 6: .env (the Tailscale key, the admin password) is not copied into the build container.
test('the web service does not copy .env into the build', () => {
  const config = spawnSync('docker', [...COMPOSE, 'config', 'web'], { encoding: 'utf8' })
  expect(config.stdout).toContain('--exclude=./.env')
})
