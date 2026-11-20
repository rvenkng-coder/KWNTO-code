import { spawnSync, execFileSync } from 'node:child_process'
import { existsSync, mkdtempSync, chmodSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

// Helpers for the backup test stack: compose.prod.yaml plus compose.backup-test.yaml (data in the
// named volume kwnto-backup-test-data, backups in a temporary host folder). Same ports as the edge stack,
// so the two test files must not run at the same time (vitest.config.ts runs container files one at a time).

export const BACKUP_VOLUME = 'kwnto-backup-test-data'
export const ADMIN_EMAIL = 'admin@example.test'
export const ADMIN_PASSWORD = 'test-admin-password-1'
const COMPOSE_FILES = ['-f', 'compose.prod.yaml', '-f', 'compose.backup-test.yaml']

export function makeBackupDir(): string {
  const dir = mkdtempSync(join(tmpdir(), 'kwnto-backups-'))
  chmodSync(dir, 0o777) // PocketBase runs as uid 10001 and must be able to write here
  return dir
}

export function backupUp(dir: string): void {
  if (!existsSync('dist/index.html')) execFileSync('npm', ['run', 'build'], { stdio: 'inherit' })
  const env = { ...process.env, KWNTO_BACKUP_DIR: dir }
  const up = spawnSync('docker', ['compose', ...COMPOSE_FILES, 'up', '-d', '--build', '--wait'], { encoding: 'utf8', env })
  if (up.status !== 0) {
    const logs = spawnSync('docker', ['compose', ...COMPOSE_FILES, 'logs', '--no-color'], { encoding: 'utf8', env })
    throw new Error(`backup stack did not start:\n${up.stderr}\n${logs.stdout}${logs.stderr}`)
  }
}

// Removes the stack, its volumes, the test volume and the temporary folder. Never throws.
export function backupDown(dir: string | undefined): void {
  const env = { ...process.env, KWNTO_BACKUP_DIR: dir ?? '/tmp' }
  spawnSync('docker', ['compose', ...COMPOSE_FILES, 'down', '-v', '--remove-orphans'], { encoding: 'utf8', env })
  spawnSync('docker', ['volume', 'rm', '-f', BACKUP_VOLUME], { encoding: 'utf8' })
  if (dir !== undefined) rmSync(dir, { recursive: true, force: true })
}

export interface ScriptResult { status: number | null; stdout: string; stderr: string }

export function runScript(script: string, args: string[], input: string, extraEnv: Record<string, string> = {}): ScriptResult {
  const env = { ...process.env, ...extraEnv }
  const res = spawnSync('sh', [script, ...args], { input, encoding: 'utf8', env })
  return { status: res.status, stdout: res.stdout, stderr: res.stderr }
}

export const backupNow = (email: string, password: string, pb = 'http://127.0.0.1:8095'): ScriptResult =>
  runScript('deploy/backup-now.sh', [], `${email}\n${password}\n`, { PB: pb })

export function restore(args: string[], input = '', extraEnv: Record<string, string> = {}): ScriptResult {
  return runScript('deploy/restore.sh', args, input, {
    KWNTO_COMPOSE_FILES: COMPOSE_FILES.join(' '),
    KWNTO_DATA_VOLUME: BACKUP_VOLUME,
    ...extraEnv,
  })
}
