import { spawnSync } from 'node:child_process'
import { chmodSync, readdirSync, readFileSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { afterAll, beforeAll, expect, test } from 'vitest'
import { EDGE_ADMIN_URL, edgeAdminToken, raw, verifiedUser } from './helpers/edge.ts'
import { ADMIN_EMAIL, ADMIN_PASSWORD, backupDown, backupNow, backupUp, makeBackupDir, restore } from './helpers/backup.ts'

// Backups and the restore (plan 6 D10, D11; security.md 7 and 9 control 8). One backup-test stack on a fresh
// named volume with the backups in a temporary host folder; the same ports as the edge stack (8094, 8095).

// The 67-byte PNG is copied from tests/rules/helpers/media.ts on purpose: the container layer does not import from the rules layer.
const PNG_1PX = new Uint8Array(
  Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAAAAAA6fptVAAAACklEQVR4nGNgAAAAAgABSK+kcQAAAABJRU5ErkJggg==', 'base64'),
)

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

const OLD_PASSWORD = ADMIN_PASSWORD
const NEW_PASSWORD = 'changed-admin-password-2'

async function adminSignIn(password: string): Promise<number> {
  const res = await fetch(`${EDGE_ADMIN_URL}/api/collections/_superusers/auth-with-password`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ identity: ADMIN_EMAIL, password }),
  })
  return res.status
}

async function readJson(token: string, path: string): Promise<Response> {
  return raw(path, { headers: { Authorization: token } })
}

// Protects Review Focus 4: a restore brings back the database, the media files and the admin account.
test('a restore brings back data, media files and the admin account', async () => {
  const user = await verifiedUser()
  const team = await createJson(user.token, '/api/collections/teams/records', { name: 'Restore team', owner: user.id })
  const project = await createJson(user.token, '/api/collections/projects/records', { team: team.id, name: 'Restore project' })
  const adminToken = await edgeAdminToken()
  const chapters = await fetch(`${EDGE_ADMIN_URL}/api/collections/chapters/records?filter=${encodeURIComponent(`project="${project.id}"`)}`, {
    headers: { Authorization: adminToken },
  })
  const chapter = ((await chapters.json()) as { items: { id: string }[] }).items[0]
  const node = await createJson(user.token, '/api/collections/nodes/records', {
    project: project.id, chapter: chapter?.id, title: 'Restore node', color: 'slate', x: 0, y: 0,
  })
  const form = new FormData()
  form.append('project', project.id)
  form.append('node', node.id)
  form.append('uploader', user.id)
  form.append('file', new Blob([PNG_1PX]), 'pixel.png')
  const upload = await raw('/api/collections/media/records', { method: 'POST', headers: { Authorization: user.token }, body: form })
  expect(upload.status, await upload.clone().text()).toBe(200)
  const media = (await upload.json()) as { id: string; file: string }

  // Backup names carry the second (manual_<UTC yyyymmdd_hhmmss>.zip): a second backup in the same second is refused.
  await new Promise((resolve) => setTimeout(resolve, 1100))
  const before = new Set(manualZips())
  const made = backupNow(ADMIN_EMAIL, ADMIN_PASSWORD)
  expect(made.status, made.stderr).toBe(0)
  const zip = manualZips().find((name) => !before.has(name))
  expect(zip).toBeDefined()

  // Damage: the team goes (admin), the admin password changes.
  const del = await fetch(`${EDGE_ADMIN_URL}/api/collections/teams/records/${team.id}`, { method: 'DELETE', headers: { Authorization: adminToken } })
  expect(del.status).toBe(204)
  const admins = await fetch(`${EDGE_ADMIN_URL}/api/collections/_superusers/records`, { headers: { Authorization: adminToken } })
  const adminId = ((await admins.json()) as { items: { id: string; email: string }[] }).items.find((a) => a.email === ADMIN_EMAIL)?.id
  const changed = await fetch(`${EDGE_ADMIN_URL}/api/collections/_superusers/records/${adminId}`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json', Authorization: adminToken },
    body: JSON.stringify({ password: NEW_PASSWORD, passwordConfirm: NEW_PASSWORD }),
  })
  expect(changed.status, await changed.clone().text()).toBe(200)
  expect(await adminSignIn(NEW_PASSWORD)).toBe(200)
  expect((await readJson(user.token, `/api/collections/projects/records/${project.id}`)).status).toBe(404)

  const res = restore(dir, ['--yes', join(dir, zip as string)])
  expect(res.status, res.stderr).toBe(0)
  expect(res.stdout).toContain(`Restored from ${join(dir, zip as string)}`)

  const projectRes = await readJson(user.token, `/api/collections/projects/records/${project.id}`)
  expect(projectRes.status).toBe(200)
  expect(((await projectRes.json()) as { name: string }).name).toBe('Restore project')
  const nodeRes = await readJson(user.token, `/api/collections/nodes/records/${node.id}`)
  expect(nodeRes.status).toBe(200)
  const tokenRes = await raw('/api/files/token', { method: 'POST', headers: { Authorization: user.token } })
  const fileToken = ((await tokenRes.json()) as { token: string }).token
  const file = await raw(`/api/files/media/${media.id}/${media.file}?token=${fileToken}`)
  expect(file.status).toBe(200)
  expect((await file.arrayBuffer()).byteLength).toBe(67)
  expect(await adminSignIn(OLD_PASSWORD)).toBe(200)
  expect(await adminSignIn(NEW_PASSWORD)).toBe(400)
  const home = await raw('/')
  expect(home.status).toBe(200)
  expect(await home.text()).toContain('<div id="root">')
}, 300_000)

// Protects D11: a wrong path or a non-zip is refused before anything is touched.
test('restore refuses a missing or broken backup before touching data', async () => {
  const missing = restore(dir, ['--yes', '/nope.zip'])
  expect(missing.status).toBe(2)
  expect(missing.stderr).toContain('No such backup: /nope.zip')
  const bad = join(dir, 'x.zip')
  writeFileSync(bad, 'this is not a zip')
  const notZip = restore(dir, ['--yes', bad])
  expect(notZip.status).toBe(2)
  expect(notZip.stderr).toContain(`Not a zip file: ${bad}`)
  // A real zip cut in half starts with PK but cannot be unpacked: refused before anything is stopped or emptied.
  const whole = readFileSync(join(dir, manualZips()[0]))
  const cut = join(dir, 'cut.zip')
  writeFileSync(cut, whole.subarray(0, Math.floor(whole.length / 2)))
  const truncated = restore(dir, ['--yes', cut])
  expect(truncated.status).toBe(2)
  expect(truncated.stderr).toContain(`Backup is damaged: ${cut}`)
  // A good backup the container's user (uid 10001) cannot read is not "damaged": exit 1, a different message, nothing touched.
  const locked = join(dir, 'locked.zip')
  writeFileSync(locked, whole, { mode: 0o600 })
  chmodSync(locked, 0o600)
  const unreadable = restore(dir, ['--yes', locked])
  expect(unreadable.status).toBe(1)
  expect(unreadable.stderr).toContain(`Could not check the backup (docker or file permission problem, see the error above): ${locked}`)
  expect(unreadable.stderr).not.toContain('damaged')
  expect((await raw('/api/health')).status).toBe(200)
  expect(await adminSignIn(OLD_PASSWORD)).toBe(200)
})

// Protects D11: without --yes nothing changes unless the admin types RESTORE.
test('restore asks before replacing all data', async () => {
  const zip = manualZips()[0]
  const file = join(dir, zip)
  const res = restore(dir, [file], 'no\n')
  expect(res.status).toBe(1)
  expect(res.stdout).toContain(`This replaces ALL data with ${file}. Type RESTORE to continue:`)
  expect(res.stdout).toContain('Data volume to be replaced: kwnto-backup-test_kwnto-data')
  expect((await raw('/api/health')).status).toBe(200)
  expect(await adminSignIn(OLD_PASSWORD)).toBe(200)
})
