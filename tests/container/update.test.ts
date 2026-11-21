import { appendFileSync, mkdtempSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterAll, beforeAll, expect, test } from 'vitest'
import { EDGE_URL, verifiedUser } from './helpers/edge.ts'
import { ADMIN_EMAIL, ADMIN_PASSWORD, makeBackupDir } from './helpers/backup.ts'
import {
  type Checkout, git, makeCheckout, manualZips, pushNewCommit, runUpdate, updateStackDown, updateStackUp,
} from './helpers/update.ts'

// deploy/update.sh (docs/admin/deployment.md, Updating): refuse what it cannot do safely, back up
// before touching anything, pull, rebuild, and wait for health. The tests share one stack and run in order.

const CREDENTIALS = `${ADMIN_EMAIL}\n${ADMIN_PASSWORD}\n`

let c: Checkout | undefined
let dir: string | undefined

const checkout = (): Checkout => { if (c === undefined) throw new Error('no checkout'); return c }
const backups = (): string => { if (dir === undefined) throw new Error('no backup folder'); return dir }

beforeAll(() => {
  updateStackDown(undefined, undefined) // left-overs of a killed earlier run
  dir = makeBackupDir()
  c = makeCheckout()
  updateStackUp(c, dir)
}, 600_000)

afterAll(() => updateStackDown(c, dir))

// Protects the guide's option C: a folder that is not a git checkout is refused with a pointer to --no-pull.
test('outside a git checkout it refuses and points to --no-pull', () => {
  const plain = mkdtempSync(join(tmpdir(), 'kwnto-plain-'))
  try {
    const res = runUpdate(checkout(), backups(), { cwd: plain, input: CREDENTIALS })
    expect(res.status).toBe(1)
    expect(res.stderr).toContain('deploy/update.sh --no-pull')
    expect(manualZips(backups())).toEqual([])
  } finally {
    rmSync(plain, { recursive: true, force: true })
  }
})

// Protects the VM's own edits: a changed tracked file is never overwritten, and nothing else happens.
test('a changed tracked file on the VM is refused before any backup', () => {
  const file = join(checkout().vm, 'deploy', 'Caddyfile')
  appendFileSync(file, '# local edit\n')
  try {
    const res = runUpdate(checkout(), backups(), { input: CREDENTIALS })
    expect(res.status).toBe(1)
    expect(res.stderr).toContain('Tracked files were changed on this machine')
    expect(manualZips(backups())).toEqual([])
  } finally {
    git(checkout().vm, ['checkout', '--', 'deploy/Caddyfile'])
  }
})

// Protects against needless backups and restarts: with nothing new upstream the script stops at once.
test('with nothing new upstream it says so and makes no backup', () => {
  const res = runUpdate(checkout(), backups())
  expect(res.status).toBe(0)
  expect(res.stdout).toContain('Already up to date')
  expect(manualZips(backups())).toEqual([])
})

// Protects "backup first": when the backup fails (wrong admin password) the code is not updated.
test('a failed backup leaves the checkout on the old commit', () => {
  const before = git(checkout().vm, ['rev-parse', 'HEAD'])
  pushNewCommit(checkout(), 'second.txt')
  const res = runUpdate(checkout(), backups(), { input: `${ADMIN_EMAIL}\nwrong-password-123\n` })
  expect(res.status).toBe(1)
  expect(res.stderr).toContain('The backup failed')
  expect(git(checkout().vm, ['rev-parse', 'HEAD'])).toBe(before)
  expect(manualZips(backups())).toEqual([])
})

// Protects the update itself: one backup, the new commit checked out, the stack healthy and the data kept.
test('an update backs up, moves to the new commit and keeps the data', async () => {
  const user = await verifiedUser()
  const target = git(checkout().dev, ['rev-parse', 'HEAD']) // pushed by the previous test
  const res = runUpdate(checkout(), backups(), { input: CREDENTIALS })
  expect(res.status, res.stderr).toBe(0)
  expect(res.stdout).toContain('Updated to')
  expect(git(checkout().vm, ['rev-parse', 'HEAD'])).toBe(target)
  expect(manualZips(backups())).toHaveLength(1)
  const read = await fetch(`${EDGE_URL}/api/collections/users/records/${user.id}`, { headers: { Authorization: user.token } })
  expect(read.status).toBe(200)
}, 400_000)

// Protects recovery: when health is not reached the script fails and names the backup and the restore command.
test('a missed health check fails and prints the backup and the restore command', () => {
  const before = manualZips(backups())
  const res = runUpdate(checkout(), backups(), {
    args: ['--no-pull'], input: CREDENTIALS, env: { KWNTO_HEALTH_SECONDS: '0' },
  })
  expect(res.status).toBe(1)
  const made = manualZips(backups()).filter((name) => !before.includes(name))
  expect(made).toHaveLength(1)
  expect(res.stderr).toContain(`deploy/restore.sh backups/${made[0]}`)
}, 400_000)
