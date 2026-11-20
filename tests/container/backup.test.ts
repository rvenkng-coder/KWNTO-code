import { spawnSync } from 'node:child_process'
import { readdirSync, readFileSync } from 'node:fs'
import { join } from 'node:path'
import { afterAll, beforeAll, expect, test } from 'vitest'
import { raw, verifiedUser } from './helpers/edge.ts'
import { ADMIN_EMAIL, ADMIN_PASSWORD, backupDown, backupNow, backupUp, makeBackupDir } from './helpers/backup.ts'

// Backups and the restore (plan 6 D10, D11; security.md 7 and 9 control 8). One backup-test stack on a fresh
// named volume with the backups in a temporary host folder; the same ports as the edge stack (8094, 8095).

let dir: string

beforeAll(() => {
  backupDown(undefined) // left-overs of a killed earlier run
  dir = makeBackupDir()
  backupUp(dir)
}, 600_000)

afterAll(() => backupDown(dir))

const manualZips = (): string[] => readdirSync(dir).filter((name) => /^manual_.*\.zip$/.test(name))

async function createJson(token: string, path: string, body: unknown): Promise<{ id: string }> {
  const res = await raw(path, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: token },
    body: JSON.stringify(body),
  })
  expect(res.status, await res.clone().text()).toBe(200)
  return (await res.json()) as { id: string }
}

// Protects design 7b and security.md 7: an admin can make a backup now, and it lands as a plain zip in the host folder.
test('an on-demand backup lands in the host folder', async () => {
  const user = await verifiedUser()
  const team = await createJson(user.token, '/api/collections/teams/records', { name: 'Backup team', owner: user.id })
  await createJson(user.token, '/api/collections/projects/records', { team: team.id, name: 'Backup project' })

  const wrong = backupNow(ADMIN_EMAIL, 'not-the-password-1')
  expect(wrong.status).toBe(1)
  expect(manualZips()).toEqual([])

  // Watch the process list while the script runs: the password must never be in it.
  const seen: string[] = []
  const timer = setInterval(() => seen.push(spawnSync('ps', ['-eo', 'args'], { encoding: 'utf8' }).stdout), 5)
  const ok = backupNow(ADMIN_EMAIL, ADMIN_PASSWORD)
  clearInterval(timer)
  expect(ok.status, ok.stderr).toBe(0)
  expect(ok.stdout).toMatch(/^Backup written: manual_\d{8}_\d{6}\.zip\n$/)
  const files = manualZips()
  expect(files).toHaveLength(1)
  expect(ok.stdout).toContain(files[0])
  expect(readFileSync(join(dir, files[0])).subarray(0, 2).toString()).toBe('PK')
  expect(seen.join('\n')).not.toContain(ADMIN_PASSWORD)
})
