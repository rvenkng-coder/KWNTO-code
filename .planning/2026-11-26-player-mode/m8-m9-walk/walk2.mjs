// Second scripted walk: the parts of design sections 5, 6 and 7c that need several people or the admin.
//   node walk2.mjs chromium|firefox
import fs from 'node:fs'
import { chromium, firefox } from '/home/paeng/Documents/06-github-projects/KWNTO/KWNTO-code-player/node_modules/playwright-core/index.mjs'
import { expect } from '/home/paeng/Documents/06-github-projects/KWNTO/KWNTO-code-player/node_modules/@playwright/test/index.mjs'
import PocketBase from '/home/paeng/Documents/06-github-projects/KWNTO/KWNTO-code-player/node_modules/pocketbase/dist/pocketbase.es.mjs'

const BASE = 'http://localhost:5190'
const PB = 'http://127.0.0.1:8093'
const browserName = process.argv[2]
const RID = `${browserName.slice(0, 2)}${Date.now() % 100000}`
const OUT = `/tmp/claude-1000/-home-paeng-Documents-06-github-projects-KWNTO-KWNTO-code-player/e0d17b2d-dcd2-4dff-9efa-2003f9e2764b/scratchpad/m8m9/${browserName}-2`
fs.rmSync(OUT, { recursive: true, force: true })
fs.mkdirSync(OUT, { recursive: true })
const T = { timeout: 15000 }
const SOON = { timeout: 20000 }
const PASSWORD = 'KwntoPass99'
const TEAM = `Crew${RID}`
const PROJECT = `Story ${RID}`

const env = Object.fromEntries(fs.readFileSync('/home/paeng/Documents/06-github-projects/KWNTO/KWNTO-code-player/.env', 'utf8')
  .split('\n').filter((l) => /^[A-Z_]+=/.test(l)).map((l) => [l.slice(0, l.indexOf('=')), l.slice(l.indexOf('=') + 1)]))
const admin = new PocketBase(PB)
await admin.collection('_superusers').authWithPassword(env.KWNTO_ADMIN_EMAIL, env.KWNTO_ADMIN_PASSWORD)
const opts = { requestKey: null }
const email = (who) => `${who}-${RID}@kwnto.test`
for (const [who, name] of [['member', 'Member'], ['invitee', 'Invitee'], ['editor', 'Editor'], ['reader', 'Reader']]) {
  await admin.collection('users').create({ email: email(who), name, password: PASSWORD, passwordConfirm: PASSWORD, verified: true }, opts)
}

const results = []
const notes = []
let current = ''
async function step(ref, name, fn) {
  current = `${ref} ${name}`
  try {
    await fn()
    results.push({ ref, name, ok: true }); console.log(`PASS ${ref} ${name}`)
  } catch (err) {
    const msg = String(err.message ?? err).split('\n').slice(0, 4).join(' | ').slice(0, 320)
    results.push({ ref, name, ok: false, msg }); console.log(`FAIL ${ref} ${name}\n     ${msg}`)
    for (const [label, p] of Object.entries(pages)) { try { await p.screenshot({ path: `${OUT}/FAIL-${ref.replace(/\W+/g, '_')}-${label}.png` }) } catch { /* gone */ } }
    for (const p of Object.values(pages)) { try { await p.keyboard.press('Escape') } catch { /* ignore */ } }
    for (const c of Object.values(contexts)) { try { await c.setOffline(false) } catch { /* ignore */ } }
  }
}

const launcher = { chromium, firefox }[browserName]
const browser = await launcher.launch()
const contexts = {}
const pages = {}
async function newUser(label, who) {
  contexts[label] = await browser.newContext({ viewport: { width: 1360, height: 860 }, acceptDownloads: true })
  pages[label] = await contexts[label].newPage()
  pages[label].on('pageerror', (e) => notes.push(`pageerror [${label}] during [${current}]: ${e.message}`.slice(0, 200)))
  if (who) await signIn(pages[label], who)
  return pages[label]
}
async function signIn(page, who) {
  await page.goto(BASE)
  await page.getByLabel('Email').fill(who === 'demo' ? 'demo@kwnto.test' : email(who))
  await page.getByLabel('Password').fill(who === 'demo' ? 'KwntoDemo99' : PASSWORD)
  await page.getByRole('button', { name: 'Sign in', exact: true }).click()
  await expect(page.getByTestId('team-list')).toBeVisible(T)
}
const panel = (p) => p.getByTestId('editor-panel')
const card = (p, id) => p.locator(`[data-testid="node-card"][data-node-id="${id}"]`)
const HEAD = { position: { x: 30, y: 12 } }
async function openTeam(p, name) {
  await p.getByTestId('team-list').getByRole('button', { name, exact: true }).click()
  await expect(p.getByTestId('member-list')).toHaveAttribute('data-loaded', 'true', T)
}
async function openProject(p, name) {
  await p.getByTestId('project-list').getByRole('button', { name, exact: true }).click()
  await expect(p.getByTestId('editor-canvas')).toBeVisible(T)
  await expect(p.getByRole('tab', { name: 'Chapter 1' })).toBeVisible(T)
}
async function ready(p, n) {
  await expect(p.getByTestId('canvas')).toHaveAttribute('data-ready', 'true', T)
  await expect(p.getByTestId('canvas')).toHaveAttribute('data-node-count', String(n), T)
}
const ids = {}
let projectId

const A = await newUser('owner', 'demo')

// ---- teams (design 5) ----
await step('5', 'create a team; the owner enables the join code', async () => {
  await A.getByRole('button', { name: 'Create team' }).click()
  await A.getByRole('dialog').getByLabel('Team name').fill(TEAM)
  await A.getByRole('dialog').getByRole('button', { name: 'Create' }).click()
  await expect(A.getByTestId('team-list')).toContainText(TEAM, T)
  await openTeam(A, TEAM)
  await expect(A.getByTestId('join-code')).toBeVisible(T)
  if (await A.getByRole('button', { name: 'Enable' }).isVisible()) await A.getByRole('button', { name: 'Enable' }).click()
  await expect(A.getByRole('button', { name: 'Disable' })).toBeVisible(T)
  ids.code = (await A.getByTestId('join-code').textContent()) ?? ''
  expect(ids.code).not.toBe('')
})
const B = await newUser('member', 'member')
await step('5', 'a member joins with the code; the owner sees the name, not the email', async () => {
  await B.getByRole('button', { name: 'Join with code' }).click()
  await B.getByPlaceholder('Join code').fill(ids.code)
  await B.getByRole('button', { name: 'Join', exact: true }).click()
  await expect(B.getByTestId('team-list')).toContainText(TEAM, T)
  await A.getByRole('button', { name: 'Teams', exact: true }).click()
  await openTeam(A, TEAM)
  await expect(A.getByTestId('member-list')).toContainText('Member', T)
  await expect(A.getByTestId('member-list')).not.toContainText('@')
})
await step('5', 'a wrong join code is refused', async () => {
  const X = await newUser('reader-wrongcode', 'reader')
  await X.getByRole('button', { name: 'Join with code' }).click()
  await X.getByPlaceholder('Join code').fill('WRONGCODE1')
  await X.getByRole('button', { name: 'Join', exact: true }).click()
  await expect(X.getByTestId('team-list')).not.toContainText(TEAM, T)
  await expect(X.getByRole('alert').or(X.locator('.error, [role=alert], .form-error'))).toBeVisible(T)
  await contexts['reader-wrongcode'].close(); delete pages['reader-wrongcode']; delete contexts['reader-wrongcode']
})
await step('5', 'invite by email: unknown address refused, real one accepted by the invitee', async () => {
  await A.getByPlaceholder('Email').fill(`nobody-${RID}@kwnto.test`)
  await A.getByRole('button', { name: 'Send invite' }).click()
  await expect(A.getByText(/exist/i)).toBeVisible(T)
  await A.getByPlaceholder('Email').fill(email('invitee'))
  await A.getByRole('button', { name: 'Send invite' }).click()
  await expect(A.getByText('Invite sent!')).toBeVisible(T)
  const C = await newUser('invitee', 'invitee')
  await C.reload()
  await expect(C.getByTestId('invite-inbox')).toContainText(TEAM, T)
  await C.getByRole('button', { name: 'Accept' }).click()
  await expect(C.getByTestId('team-list')).toContainText(TEAM, T)
})

// ---- a project to work on ----
await step('5', 'the owner creates a project; the member sees it', async () => {
  await A.getByRole('button', { name: 'New project' }).click()
  await A.getByLabel('Project name').fill(PROJECT)
  await A.getByRole('button', { name: 'Create project' }).click()
  await expect(A.getByTestId('project-list')).toContainText(PROJECT, T)
  const rec = await admin.collection('projects').getFirstListItem(admin.filter('name = {:n}', { n: PROJECT }), opts)
  projectId = rec.id
  const ch = await admin.collection('chapters').getFirstListItem(admin.filter('project = {:p}', { p: projectId }), opts)
  const node = (title, x) => admin.collection('nodes').create({ project: projectId, chapter: ch.id, title, color: 'blue', x, y: 60 }, opts)
  ids.alpha = (await node('Alpha', 60)).id
  ids.beta = (await node('Beta', 460)).id
  await admin.collection('script_lines').create({ project: projectId, node: ids.alpha, character: 'ANNA', text: 'Hello.', sort_order: 1 }, opts)
  await openTeam(B, TEAM)
  await expect(B.getByTestId('project-list')).toContainText(PROJECT, T)
  await openProject(A, PROJECT); await ready(A, 2)
  await openProject(B, PROJECT); await ready(B, 2)
})

// ---- live editing (design 5, 6.7) ----
await step('5', 'presence: a teammate editing a node shows "Member is editing"', async () => {
  await card(A, ids.alpha).click(HEAD)
  await card(B, ids.alpha).click(HEAD)
  await panel(B).getByLabel('Title', { exact: true }).focus()
  await expect(card(A, ids.alpha).getByTestId('editing-badge')).toHaveText('Member is editing', SOON)
  await B.evaluate(() => document.activeElement?.blur())
  await expect(card(A, ids.alpha).getByTestId('editing-badge')).toHaveCount(0, SOON)
})
await step('5', 'a change by one person appears live for the other', async () => {
  await card(B, ids.beta).click(HEAD)
  await panel(B).getByLabel('Title', { exact: true }).fill('Beta live'); await panel(B).getByLabel('Title', { exact: true }).blur()
  await expect(card(A, ids.beta)).toContainText('Beta live', SOON)
})
await step('6.7', 'conflict: offline edit vs a teammate\'s edit asks keep mine / keep theirs', async () => {
  await contexts.owner.setOffline(true)
  await expect(A.getByTestId('sync-status')).toContainText('Offline', T)
  await card(A, ids.alpha).click(HEAD)
  await panel(A).getByLabel('Title', { exact: true }).fill('Mine'); await panel(A).getByLabel('Title', { exact: true }).blur()
  await card(B, ids.alpha).click(HEAD)
  await panel(B).getByLabel('Title', { exact: true }).fill('Theirs'); await panel(B).getByLabel('Title', { exact: true }).blur()
  await expect.poll(async () => (await admin.collection('nodes').getOne(ids.alpha, opts)).title, SOON).toBe('Theirs')
  await contexts.owner.setOffline(false)
  const dialog = A.getByRole('dialog')
  await expect(dialog).toContainText('Someone else changed this while you were offline', SOON)
  await expect(dialog).toContainText('Mine'); await expect(dialog).toContainText('Theirs')
  await A.screenshot({ path: `${OUT}/conflict-dialog.png` })
  await dialog.getByRole('button', { name: 'Keep theirs' }).click()
  await expect(dialog).toHaveCount(0, T)
  await expect(card(A, ids.alpha)).toContainText('Theirs', T)
})

// ---- comments (design 5) ----
await step('5', 'a member comments; the owner sees it live and a count on the card; the owner deletes it', async () => {
  await card(A, ids.alpha).click(HEAD); await card(B, ids.alpha).click(HEAD)
  await panel(B).getByLabel('Add a comment').fill('Line 3 needs a pause')
  await panel(B).getByRole('button', { name: 'Comment', exact: true }).click()
  await expect(panel(A).getByTestId('comment-row')).toHaveCount(1, SOON)
  await expect(panel(A).getByTestId('comment-row').first()).toContainText('Member')
  await expect(card(A, ids.alpha).getByTestId('comment-badge')).toHaveText('1', T)
  await panel(A).getByTestId('comment-row').first().getByRole('button', { name: 'Delete' }).click()
  await panel(A).getByTestId('comment-row').first().getByRole('button', { name: 'Delete' }).click()
  await expect(panel(A).getByTestId('comment-row')).toHaveCount(0, T)
  await expect(panel(B).getByTestId('comment-row')).toHaveCount(0, SOON)
})

// ---- media rules (design 5, 6.2, 6.8) ----
const PNG = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAAAAAA6fptVAAAACklEQVR4nGNgAAAAAgABSK+kcQAAAABJRU5ErkJggg==', 'base64')
await step('6.8', 'a member removes media; only the owner sees it in "removed" and restores it', async () => {
  await card(A, ids.alpha).click(HEAD)
  await panel(A).getByLabel('Add media').setInputFiles({ name: 'a.png', mimeType: 'image/png', buffer: PNG })
  await expect(panel(A).getByTestId('media-item')).toHaveCount(1, T)
  await card(B, ids.alpha).click(HEAD)
  await expect(panel(B).getByTestId('media-item')).toHaveCount(1, SOON)
  const item = panel(B).getByTestId('media-item').first()
  await item.getByRole('button', { name: 'Remove' }).click()
  await item.getByRole('button', { name: 'Remove' }).click()
  await expect(panel(B).getByTestId('media-item')).toHaveCount(0, T)
  await expect(panel(B).getByTestId('removed-media-item')).toHaveCount(0)
  await expect(panel(A).getByTestId('removed-media-item')).toHaveCount(1, SOON)
  await panel(A).getByTestId('removed-media-item').first().getByRole('button', { name: 'Restore' }).click()
  await expect(panel(A).getByTestId('media-item')).toHaveCount(1, T)
})
await step('6.2', 'a file over the per-file limit is refused with a clear message', async () => {
  const big = Buffer.alloc(51 * 1024 * 1024); PNG.copy(big)
  fs.writeFileSync(`${OUT}/huge.png`, big)
  await panel(A).getByLabel('Add media').setInputFiles(`${OUT}/huge.png`)
  await expect(panel(A).getByRole('alert')).toBeVisible(T)
  notes.push(`size refusal text: ${(await panel(A).getByRole('alert').first().textContent())?.slice(0, 120)}`)
  await expect(panel(A).getByTestId('media-item')).toHaveCount(1)
})
await step('6.2', 'over the owner\'s storage quota, uploads are refused and nothing is deleted', async () => {
  const demo = await admin.collection('users').getFirstListItem(admin.filter('email = {:e}', { e: 'demo@kwnto.test' }), opts)
  const row = await admin.collection('user_limits').getFirstListItem(admin.filter('user = {:u}', { u: demo.id }), opts)
  await admin.collection('user_limits').update(row.id, { quota_override_bytes: 100 }, opts)
  try {
    await A.reload(); await ready(A, 2)
    await card(A, ids.alpha).click(HEAD)
    await panel(A).getByLabel('Add media').setInputFiles({ name: 'b.png', mimeType: 'image/png', buffer: PNG })
    await expect(panel(A).getByRole('alert')).toBeVisible(T)
    notes.push(`quota refusal text: ${(await panel(A).getByRole('alert').first().textContent())?.slice(0, 140)}`)
    await expect(panel(A).getByTestId('media-item')).toHaveCount(1)
  } finally {
    await admin.collection('user_limits').update(row.id, { quota_override_bytes: 0 }, opts).catch(() => {})
  }
})

// ---- tabs, chapter trash, zoom (design 6.1 to 6.3, 6.8) ----
await step('6.3', 'a tab can be resized by dragging its edge', async () => {
  const tab = A.getByRole('tab', { name: 'Chapter 1' }).locator('..')
  const handle = tab.getByRole('separator', { name: 'Resize tab' })
  const before = (await tab.boundingBox()).width
  const box = await handle.boundingBox(); const y = box.y + box.height / 2
  await A.mouse.move(box.x + 1, y); await A.mouse.down(); await A.mouse.move(box.x + 61, y, { steps: 5 }); await A.mouse.up()
  await expect.poll(async () => (await tab.boundingBox()).width).toBeGreaterThan(before + 40)
})
await step('6.3', 'a chapter goes to the trash and comes back with its nodes', async () => {
  await A.getByRole('button', { name: 'Add chapter' }).click()
  await expect(A.getByRole('tab', { name: 'Chapter 2' })).toBeVisible(T)
  await A.getByRole('button', { name: 'Menu for Chapter 2' }).click()
  await A.getByRole('menuitem', { name: 'Move to trash' }).click()
  await A.getByRole('dialog').getByRole('button', { name: 'Move to trash' }).click()
  await expect(A.getByRole('tab', { name: 'Chapter 2' })).toHaveCount(0, T)
  await A.getByRole('button', { name: 'All chapters' }).click()
  await A.getByRole('menuitem', { name: 'Trash' }).click()
  const trash = A.getByRole('dialog', { name: 'Trash' })
  await expect(trash).toContainText('Chapter 2', T)
  await trash.getByRole('button', { name: 'Restore' }).first().click()
  await expect(A.getByRole('tab', { name: 'Chapter 2' })).toBeVisible(T)
  await A.getByRole('button', { name: 'Close trash' }).click()
})
await step('6.1', 'zoom in and out with the canvas controls', async () => {
  const vp = A.locator('.react-flow__viewport')
  const scale = async () => Number(/scale\(([\d.]+)\)/.exec((await vp.getAttribute('style')) ?? '')?.[1] ?? 1)
  await A.getByRole('tab', { name: 'Chapter 1' }).click()
  const s0 = await scale()
  await A.locator('.react-flow__controls-zoomin').click()
  await expect.poll(scale).toBeGreaterThan(s0)
  await A.locator('.react-flow__controls-zoomout').click(); await A.locator('.react-flow__controls-zoomout').click()
  await expect.poll(scale).toBeLessThan(s0)
})

// ---- export of the whole project (design 6.5) ----
await step('6.5', 'export the whole project as PDF and Word (one page per chapter with nodes)', async () => {
  const exportAs = async (format) => {
    await A.getByRole('button', { name: 'Export map', exact: true }).click()
    const dlg = A.getByRole('dialog', { name: 'Export map' })
    await dlg.getByRole('radio', { name: format, exact: true }).check()
    await dlg.getByRole('radio', { name: 'Whole project', exact: true }).check()
    const [download] = await Promise.all([A.waitForEvent('download', { timeout: 30000 }), dlg.getByRole('button', { name: 'Export', exact: true }).click()])
    const chunks = []; for await (const c of await download.createReadStream()) chunks.push(c)
    const bytes = Buffer.concat(chunks)
    if (await dlg.isVisible()) await dlg.getByRole('button', { name: 'Close' }).click().catch(() => {})
    return { name: download.suggestedFilename(), bytes }
  }
  const pdf = await exportAs('PDF'); expect(pdf.name).toBe(`${PROJECT}.pdf`); expect(pdf.bytes.subarray(0, 5).toString()).toBe('%PDF-')
  const docx = await exportAs('Word'); expect(docx.name).toBe(`${PROJECT}.docx`); expect(docx.bytes.subarray(0, 2).toString()).toBe('PK')
})

// ---- share links (design 5) ----
let linksMade = 0
async function makeLink(permission, kind) {
  await A.getByRole('button', { name: 'Share' }).click()
  const dlg = A.getByRole('dialog')
  await dlg.getByLabel('Who can open it').selectOption({ label: permission })
  await dlg.getByLabel('Kind').selectOption({ label: kind })
  await dlg.getByRole('button', { name: 'Create link' }).click()
  linksMade += 1
  await expect(dlg.getByTestId('link-row')).toHaveCount(linksMade, T)
  return dlg.getByTestId('link-row').first().getByLabel('Link address').inputValue()
}
const closeShare = async () => { await A.getByRole('dialog').getByRole('button', { name: 'Close', exact: true }).click(); await expect(A.getByRole('dialog')).toHaveCount(0, T) }
await step('5', 'a snapshot link keeps the project as published; revoking it stops it', async () => {
  const addr = await makeLink('Can view', 'Snapshot')
  const E = await newUser('anon', null)
  await E.goto(addr)
  await expect(E.getByRole('heading', { name: PROJECT })).toBeVisible(T)
  const titleNow = (await admin.collection('nodes').getOne(ids.beta, opts)).title
  await expect(E.getByTestId('node-card').filter({ hasText: titleNow })).toBeVisible(T)
  await admin.collection('nodes').update(ids.beta, { title: 'Beta changed', version: (await admin.collection('nodes').getOne(ids.beta, opts)).version }, opts)
  await E.reload()
  await expect(E.getByTestId('node-card').filter({ hasText: titleNow })).toBeVisible(T)
  await expect(E.getByTestId('node-card').filter({ hasText: 'Beta changed' })).toHaveCount(0)
  await A.getByRole('dialog').getByTestId('link-row').first().getByRole('button', { name: 'Republish' }).click()
  await E.reload()
  await expect(E.getByTestId('node-card').filter({ hasText: 'Beta changed' })).toBeVisible(SOON)
  const row = A.getByRole('dialog').getByTestId('link-row').first()
  await row.getByRole('button', { name: 'Revoke', exact: true }).click()
  await expect(row).toContainText('Revoke this link?', T)
  await row.getByRole('button', { name: 'Revoke', exact: true }).click()
  await expect(row).toContainText('Revoked', T)
  await E.reload()
  await expect(E.getByText('This link is not valid or was revoked.')).toBeVisible(T)
  await closeShare()
})
await step('5', 'a comment link asks for a sign-in, then the person can comment', async () => {
  const addr = await makeLink('Can comment', 'Live')
  await closeShare()
  const R = await newUser('reader', null)
  await R.goto(addr)
  await expect(R.getByText('Sign in to open this shared project.')).toBeVisible(T)
  await R.getByRole('button', { name: 'Sign in', exact: true }).click()
  await R.getByLabel('Email').fill(email('reader')); await R.getByLabel('Password').fill(PASSWORD)
  await R.getByRole('button', { name: 'Sign in', exact: true }).click()
  await expect(R.getByRole('heading', { name: PROJECT })).toBeVisible(T)
  await R.getByTestId('node-card').filter({ hasText: 'Theirs' }).first().click(HEAD)
  await R.getByLabel('Add a comment').fill('From a comment link')
  await R.getByRole('button', { name: 'Comment', exact: true }).click()
  await card(A, ids.alpha).click(HEAD)
  await expect(panel(A).getByTestId('comment-row')).toContainText('From a comment link', SOON)
})
await step('5', 'an edit link lets a non-member edit that one project; it is listed under Shared with me', async () => {
  const addr = await makeLink('Can edit', 'Live')
  await closeShare()
  const D = await newUser('editor', 'editor')
  await D.goto(addr)
  await expect(D.getByTestId('editor-canvas')).toBeVisible(T)
  await D.getByRole('tab', { name: 'Chapter 1' }).waitFor(T)
  await expect(D.getByTestId('node-card').first()).toBeVisible(T)
  await D.getByTestId('node-card').filter({ hasText: 'Beta' }).first().click(HEAD)
  await panel(D).getByLabel('Title', { exact: true }).fill('Edited by link'); await panel(D).getByLabel('Title', { exact: true }).blur()
  await expect(card(A, ids.beta)).toContainText('Edited by link', SOON)
  await D.getByRole('button', { name: 'Back to teams' }).click()
  await expect(D.getByTestId('team-list')).not.toContainText(TEAM)
  await expect(D.getByText(PROJECT)).toBeVisible(T)
})

// ---- project trash (design 6.8) ----
await step('6.8', 'the owner trashes and restores a project; a member does not see the trash', async () => {
  await A.getByRole('button', { name: 'Back to teams' }).click()
  await openTeam(A, TEAM)
  await expect(A.getByTestId('project-list')).toHaveAttribute('data-loaded', 'true', T)
  await A.getByRole('button', { name: 'Move to trash' }).first().click()
  await A.getByRole('dialog').getByRole('button', { name: 'Move to trash' }).click()
  await expect(A.getByTestId('project-list')).not.toContainText(PROJECT, T)
  await expect(A.getByTestId('team-trash')).toContainText('30 days left', T)
  await B.getByRole('button', { name: 'Back to teams' }).click()
  await openTeam(B, TEAM)
  await expect(B.getByTestId('team-trash')).toHaveCount(0)
  await A.getByTestId('team-trash').getByRole('button', { name: 'Restore' }).click()
  await expect(A.getByTestId('project-list')).toContainText(PROJECT, T)
})

// ---- admin dashboard and security log (design 6.9, 7c) ----
await step('6.9', 'the admin reads the security log in the PocketBase dashboard', async () => {
  const ctx = await browser.newContext({ viewport: { width: 1360, height: 860 } })
  const P = await ctx.newPage()
  await P.goto(`${PB}/_/`)
  await P.locator('#login_email, input[type=email]').first().fill(env.KWNTO_ADMIN_EMAIL)
  await P.locator('#login_pass').fill(env.KWNTO_ADMIN_PASSWORD)
  await P.getByRole('button', { name: /Login/i }).click()
  await expect(P.getByText('security_events').first()).toBeVisible(T)
  await P.getByText('security_events').first().click()
  await expect(P.locator('.table-row, tbody tr').first()).toBeVisible(T)
  await P.screenshot({ path: `${OUT}/security-log.png` })
  const rows = await P.locator('.table-row, tbody tr').count()
  notes.push(`security_events rows visible: ${rows}`)
  expect(rows).toBeGreaterThan(0)
  await ctx.close()
})

console.log('\nnotes:'); for (const n of notes.slice(0, 12)) console.log('  ' + n)
fs.writeFileSync(`${OUT}/results.json`, JSON.stringify({ browser: browserName, results, notes }, null, 2))
const failed = results.filter((r) => !r.ok)
console.log(`\n${browserName}: ${results.length - failed.length} of ${results.length} steps passed`)
await browser.close()
