import { execFileSync, spawnSync } from 'node:child_process'
import { cpSync, existsSync, mkdtempSync, readdirSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { BACKUP_VOLUME, type ScriptResult } from './backup.ts'

// Helpers for tests/container/update.test.ts. deploy/update.sh runs in a "VM" checkout: a clone of a
// throwaway bare upstream that holds only the files the stack needs, so the test can push a new
// commit upstream and watch the script pull it. The stack is the backup-test stack (same project
// name and ports as backup.test.ts; container files run one at a time), started from that clone.

const STACK_FILES = ['compose.prod.yaml', 'compose.backup-test.yaml', 'backend', 'deploy']
export const COMPOSE_FILES = '-f compose.prod.yaml -f compose.backup-test.yaml'

// A fixed identity and no global or system git config, so the developer's hooks and settings stay out.
const GIT_ENV = {
  GIT_AUTHOR_NAME: 'update test',
  GIT_AUTHOR_EMAIL: 'update-test@example.test',
  GIT_COMMITTER_NAME: 'update test',
  GIT_COMMITTER_EMAIL: 'update-test@example.test',
  GIT_CONFIG_GLOBAL: '/dev/null',
  GIT_CONFIG_NOSYSTEM: '1',
}

export interface Checkout { root: string; vm: string; dev: string }

export function git(cwd: string, args: string[]): string {
  return execFileSync('git', args, { cwd, encoding: 'utf8', env: { ...process.env, ...GIT_ENV } }).trim()
}

export function makeCheckout(): Checkout {
  const root = mkdtempSync(join(tmpdir(), 'kwnto-update-'))
  const seed = join(root, 'seed')
  for (const file of STACK_FILES) cpSync(file, join(seed, file), { recursive: true })
  git(seed, ['init', '-q', '-b', 'main'])
  git(seed, ['add', '-A'])
  git(seed, ['commit', '-q', '-m', 'first version'])
  git(root, ['clone', '-q', '--bare', 'seed', 'up.git'])
  git(root, ['clone', '-q', 'up.git', 'vm'])
  git(root, ['clone', '-q', 'up.git', 'dev'])
  if (!existsSync('dist/index.html')) execFileSync('npm', ['run', 'build'], { stdio: 'inherit' })
  // Untracked in the clone, as the built app is on the VM; update.sh ignores untracked files.
  cpSync('dist', join(root, 'vm', 'dist'), { recursive: true })
  return { root, vm: join(root, 'vm'), dev: join(root, 'dev') }
}

// Commits a new file in the developer's clone and pushes it; returns the new commit.
export function pushNewCommit(c: Checkout, name: string): string {
  writeFileSync(join(c.dev, name), `${name}\n`)
  git(c.dev, ['add', name])
  git(c.dev, ['commit', '-q', '-m', `add ${name}`])
  git(c.dev, ['push', '-q', 'origin', 'main'])
  return git(c.dev, ['rev-parse', 'HEAD'])
}

function compose(c: Checkout, backupDir: string, args: string[]): ReturnType<typeof spawnSync> {
  const env = { ...process.env, KWNTO_BACKUP_DIR: backupDir }
  return spawnSync('docker', ['compose', ...COMPOSE_FILES.split(' '), ...args], { cwd: c.vm, encoding: 'utf8', env })
}

export function updateStackUp(c: Checkout, backupDir: string): void {
  const up = compose(c, backupDir, ['up', '-d', '--build', '--wait'])
  if (up.status !== 0) {
    const logs = compose(c, backupDir, ['logs', '--no-color'])
    throw new Error(`update stack did not start:\n${String(up.stderr)}\n${String(logs.stdout)}${String(logs.stderr)}`)
  }
}

// Removes the stack, its volumes and the temporary folders. Never throws.
export function updateStackDown(c: Checkout | undefined, backupDir: string | undefined): void {
  if (c !== undefined) compose(c, backupDir ?? '/tmp', ['down', '-v', '--remove-orphans'])
  spawnSync('docker', ['volume', 'rm', '-f', BACKUP_VOLUME], { encoding: 'utf8' })
  if (c !== undefined) rmSync(c.root, { recursive: true, force: true })
  if (backupDir !== undefined) rmSync(backupDir, { recursive: true, force: true })
}

// Runs the VM clone's deploy/update.sh with `cwd` as the current folder (the VM clone by default).
export function runUpdate(
  c: Checkout, backupDir: string, opts: { args?: string[]; input?: string; cwd?: string; env?: Record<string, string> } = {},
): ScriptResult {
  const env = { ...process.env, ...GIT_ENV, KWNTO_COMPOSE_FILES: COMPOSE_FILES, KWNTO_BACKUP_DIR: backupDir, ...opts.env }
  const res = spawnSync('sh', [join(c.vm, 'deploy', 'update.sh'), ...(opts.args ?? [])], {
    cwd: opts.cwd ?? c.vm, input: opts.input ?? '', encoding: 'utf8', env,
  })
  return { status: res.status, stdout: res.stdout, stderr: res.stderr }
}

export const manualZips = (dir: string): string[] => readdirSync(dir).filter((name) => /^manual_.*\.zip$/.test(name))
